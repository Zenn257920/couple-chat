# We Talk 💙 — Friend Chat App

A multi-user real-time chat app — **sign up, add friends, chat 1:1 or in
groups** — as an Android APK installed directly (sideload), **no Play Store**.

- **Sign up / log in** with Google or email + password (Better Auth).
  Google sign-in appears once the Google OAuth client is configured.
- **Friends only** — add someone as a friend before you can message them.
  No public rooms. Chat **1:1** or create a **group** with your friends.
- **Messages:** text, photos, voice messages, reactions, replies, and
  message editing (no delete). Read ticks (✓ sent, ✓✓ read), typing
  indicator, online / last seen, auto-scroll, optimistic send.
- **Push notifications** (FCM) — messages arrive even when the app is
  closed. Photos, emoji picker, wallpapers, and profile photos included.
- **Together counter** — on a room with a together date set (for example
  the couple's DM), the header shows a live "together for N days" counter.

## How real-time works

The app polls `GET /api/messages` every **1.5 seconds** against Neon
PostgreSQL (via the Next.js API routes on Vercel). Typing pings go to
`POST /api/typing` and are shown for 5 seconds; opening a room marks
its messages read via `POST /api/messages/read`. Presence heartbeats
(`chat_presence`) update online / last seen every 10 seconds.

Tables (in the existing `kaung-portfolio` Neon database, `neondb` —
portfolio tables are untouched):

- `user`, `session`, `account`, `verification` — Better Auth
- `rooms` — `dm` or `group`, with an optional `together_since` date
- `room_members`, `friendships` — `pending` / `accepted` / `blocked`
- `chat_messages` — `id, room_id, sender (Better Auth user id), body, kind, created_at, read_at`
- `chat_typing` — `(room_id, user_id)` (PK), `updated_at`
- `push_tokens`, `chat_reactions`, `chat_presence`, `chat_profiles`, `chat_meta`

See `scripts/chat-auth-schema.mjs` and `scripts/chat-rooms-schema.mjs`.

## Deploy to Vercel (do this first — the APK loads this site)

1. In Vercel, create a new project from this GitHub repo
   (`Zenn257920/couple-chat`, `main` branch).
2. Set these environment variables for Production, Preview **and**
   Development:
   - **`DATABASE_URL`** — the **pooled** Neon connection URI for project
     `kaung-portfolio` (`green-wind-56000506`, database `neondb`, role
     `neondb_owner`). Get it from the Neon console — never commit it.
   - **`BETTER_AUTH_SECRET`** — a long random secret.
   - **`BETTER_AUTH_URL`** — the site URL, e.g.
     `https://couple-chat-umber.vercel.app`
   - **`FIREBASE_PROJECT_ID`**, **`FIREBASE_CLIENT_EMAIL`**,
     **`FIREBASE_PRIVATE_KEY`** — for FCM push notifications
     (Firebase project `lovechat-d3770`).
   - **`GOOGLE_CLIENT_ID`**, **`GOOGLE_CLIENT_SECRET`** (optional) —
     enables the Google sign-in button.
3. Deploy. The site is live at
   `https://couple-chat-umber.vercel.app` (if Vercel gives it a different
   URL, update `server.url` in `capacitor.config.ts`, run
   `npx cap sync android`, and push again).

## Build the APK (GitHub Actions — no local Android SDK needed)

Every push to `main` runs `.github/workflows/android.yml`: it installs
dependencies, makes sure the Capacitor Android project is complete,
generates the app icons (`@capacitor/assets`), builds with Gradle
(`assembleDebug`), and uploads the APK as the artifact
**`kaung-love-apk`** (`app-debug.apk`).

> Note: `android/` in this repo holds the generated project's text files,
> but its binary defaults (launcher/splash PNGs, Gradle wrapper jar)
> are **not** committed — they are regenerated in CI with
> `npx cap add android`. Locally, run `npx cap add android` once to
> generate them (delete `android/` first if it already exists).

> **Stable signing:** the build restores the fixed debug keystore
> (`keystore-debug.keystore` in the repo root) to
> `~/.android/debug.keystore` and bumps `versionCode` to the GitHub run
> number, so every APK is signed with the **same key** — updates install
> **over** the old app (no delete, login and data kept). A delete is only
> needed once when switching from an older APK signed with a random
> CI key.

1. Open the Actions run on GitHub, download the `kaung-love-apk` artifact.
2. Send the `.apk` file to the other phone (Telegram / Messenger / Drive…).
3. On the phone, tap the file to install. Android will ask to
   **Allow install from unknown apps** for that app — allow it once.
   (Play Protect may show a warning because the app is not from the
   Play Store — that is expected for sideloading; tap Install anyway.)
4. Open the app, sign up or log in, add friends, and start chatting. 💙

**Note:** the APK is a Capacitor WebView wrapper around the Vercel site
(`server.url` in `capacitor.config.ts`), so it needs internet to show
live messages. The backend lives on Vercel + Neon, not inside the APK.
Web/server changes deploy via Vercel with no APK reinstall; only native
changes (plugins, manifest, app icon) need a new APK.

## Local development

```bash
npm install
# create the auth + rooms tables (fetches the Neon URI via the API, never prints it)
# node scripts/chat-auth-schema.mjs
# node scripts/chat-rooms-schema.mjs
npm run dev
```

`npm run build` must pass (`tsc` + `next build`). The app runs without
`DATABASE_URL` for the UI shell, but the API routes need it to load/send
messages.

## Tech

Next.js 15, React 19, TypeScript, Tailwind CSS v4,
`@neondatabase/serverless` + Drizzle ORM, Better Auth, Capacitor 7
(`com.kaung.lovechat`), `@capacitor/push-notifications` (FCM),
`capacitor-voice-recorder`, Lucide icons.
