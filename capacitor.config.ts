import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor wrapper for the Android APK (sideload — no Play Store).
//
// IMPORTANT: this app is NOT a fully offline bundle. The chat backend
// (Next.js API routes + Neon PostgreSQL) lives on Vercel, so the APK is
// a WebView wrapper that loads the live site at server.url below.
// That is why the APK needs internet to show live messages.
// Live Vercel URL (verified 2026-11-21): https://couple-chat-umber.vercel.app
// NOTE: https://couple-chat.vercel.app is taken by another Vercel team
// (404 DEPLOYMENT_NOT_FOUND for us) — do NOT point server.url there.
// If the deployed URL ever changes, update server.url here, re-run
// `npx cap sync android` and rebuild the APK via GitHub Actions
// (.github/workflows/android.yml).
const config: CapacitorConfig = {
  appId: "com.kaung.lovechat",
  appName: "ကိုကို & ကလေးလေး",
  webDir: "out",
  server: {
    url: "https://couple-chat-umber.vercel.app",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
