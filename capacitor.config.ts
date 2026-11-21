import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor wrapper for the Android APK (sideload — no Play Store).
//
// IMPORTANT: this app is NOT a fully offline bundle. The chat backend
// (Next.js API routes + Neon PostgreSQL) lives on Vercel, so the APK is
// a WebView wrapper that loads the live site at server.url below.
// That is why the APK needs internet to show live messages.
// The future Vercel URL is https://couple-chat.vercel.app — update
// server.url here if the deployed project ends up on a different URL,
// then re-run `npx cap sync android` and rebuild the APK via
// GitHub Actions (.github/workflows/android.yml).
const config: CapacitorConfig = {
  appId: "com.kaung.lovechat",
  appName: "ကိုကို & ကလေးလေး",
  webDir: "out",
  server: {
    url: "https://couple-chat.vercel.app",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
