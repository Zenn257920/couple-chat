import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";

import { db } from "@/db";
import * as schema from "@/db/schema";

// Auth for the multi-user chat: email+password always works (including
// inside the Android app's WebView); Google sign-in is enabled once
// the Google OAuth client exists (GOOGLE_CLIENT_ID/SECRET in Vercel).
// Google's web button is often blocked inside a WebView, so the app
// relies on email+password there.
const baseURL =
  process.env.BETTER_AUTH_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const auth = betterAuth({
  baseURL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    // Sign up lands straight in the app (no email verification step —
    // the chat is friends-only, so a verified email buys nothing).
    autoSignIn: true,
  },
  socialProviders: {
    ...(googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : {}),
  },
});
