import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import * as schema from "@/db/schema";
import {
  consumeSignupVerification,
  isSignupVerified,
} from "@/lib/signup-otp";

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
    // No auto sign-in after sign-up: the sign-up form verifies the
    // email with an OTP first, then the user signs in explicitly.
    autoSignIn: false,
  },
  databaseHooks: {
    user: {
      create: {
        // No account without a verified email: sign-up is only allowed
        // within 15 minutes after the OTP was verified (see signup-otp).
        // This is a backstop — the sign-up form already verifies the
        // OTP before calling sign-up.
        before: async (user) => {
          if (!(await isSignupVerified(user.email))) {
            throw new APIError("BAD_REQUEST", {
              message: "Please verify your email with the OTP code first.",
            });
          }
        },
        after: async (user) => {
          try {
            // Creation is only reachable after OTP verification (see the
            // before hook), so the email is verified from day one.
            await db
              .update(schema.user)
              .set({ emailVerified: true })
              .where(eq(schema.user.id, user.id));
          } catch (error) {
            console.error("[mark email verified]", error);
          }
          try {
            await consumeSignupVerification(user.email);
          } catch (error) {
            console.error("[consume signup verification]", error);
          }
        },
      },
    },
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
