// Full push notifications via Firebase Cloud Messaging (FCM HTTP v1).
//
// No firebase-admin dependency: the OAuth2 access token is minted by
// hand with a signed JWT (node:crypto) from the service-account
// credentials, then the message is sent with plain fetch.
//
// Server credentials come from Vercel env vars (set by Kaung in the
// Vercel dashboard, from the Firebase service-account JSON):
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
// If any of them is missing, push is silently skipped — message
// sending must never break because push is not configured yet.
// The Android app side also needs google-services.json in android/app/
// (from the Firebase console); until then the APK build succeeds but
// token registration fails gracefully at runtime.
import { createSign } from "node:crypto";
import { deletePushToken, getPushTokens } from "./db";
import type { Sender } from "./names";

let cachedToken: { value: string; expiresAt: number } | null = null;

function firebaseConfig(): {
  projectId: string;
  clientEmail: string;
  privateKey: string;
} | null {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Vercel stores the pasted key with literal \n sequences.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

function base64url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

// Mint a short-lived OAuth2 access token for the FCM API.
async function getAccessToken(): Promise<string | null> {
  const cfg = firebaseConfig();
  if (!cfg) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }
  try {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const payload = {
      iss: cfg.clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };
    const unsigned = `${base64url(JSON.stringify(header))}.${base64url(
      JSON.stringify(payload),
    )}`;
    const signature = createSign("RSA-SHA256")
      .update(unsigned)
      .sign(cfg.privateKey, "base64url");
    const jwt = `${unsigned}.${signature}`;
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });
    if (!res.ok) {
      console.error("FCM access token failed", res.status);
      return null;
    }
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) return null;
    // Tokens live 1h; refresh a little early.
    cachedToken = {
      value: data.access_token,
      expiresAt: Date.now() + 55 * 60 * 1000,
    };
    return data.access_token;
  } catch (e) {
    console.error("FCM access token error", e);
    return null;
  }
}

// Send a system notification to every device registered for `recipient`.
// Best-effort: any failure is logged, never thrown — the chat message
// itself was already saved before this runs.
export async function sendPushTo(
  recipient: Sender,
  title: string,
  body: string,
  senderId: Sender,
): Promise<void> {
  try {
    const cfg = firebaseConfig();
    if (!cfg) return; // Firebase not configured yet.
    const tokens = await getPushTokens(recipient);
    if (!tokens.length) return;
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    for (const token of tokens) {
      try {
        const res = await fetch(
          `https://fcm.googleapis.com/v1/projects/${cfg.projectId}/messages:send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token,
                notification: { title, body },
                android: { priority: "high" },
                data: { sender: senderId, type: "message" },
              },
            }),
          },
        );
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as {
            error?: { message?: string; details?: { errorCode?: string }[] };
          };
          const code = err.error?.details?.[0]?.errorCode ?? "";
          // Stale/unregistered token — drop it so we stop trying.
          if (code === "UNREGISTERED" || res.status === 404) {
            await deletePushToken(token).catch(() => {});
          } else {
            console.error("FCM send failed", res.status, err.error?.message);
          }
        }
      } catch (e) {
        console.error("FCM send error", e);
      }
    }
  } catch (e) {
    console.error("sendPushTo failed", e);
  }
}
