# ကိုကို & ကလေးလေး 💙 — Private Chat

A private real-time chat app for just two people — **ကိုကို (Kaung)** and
**ကလေးလေး** — as an Android APK installed directly (sideload), **no Play Store**.

- **Text only in v1** — no photo sending yet.
- No login, no other users, no fake seeded messages. The chat starts empty.
- Each phone picks its identity on first open (**ကိုကို** / **ကလေးလေး**),
  stored in `localStorage`. Settings can switch identity and edit either
  display name. (Internal sender ids in the database/API stay `kaung` /
  `love` — only the displayed names change.)
- Ice Blue `#EAF2F8` / Ocean `#174A7C` theme, mobile-first and app-like:
  message bubbles, timestamps, date separators, read ticks (✓ sent,
  ✓✓ read), typing indicator, auto-scroll, optimistic send.

## How real-time works

The app polls `GET /api/messages` every **1.5 seconds** against Neon
PostgreSQL (via the Next.js API routes on Vercel). Typing pings go to
`POST /api/typing` and are shown for 5 seconds; opening the chat marks
the other person's messages read via `POST /api/messages/read`.

Tables (in the existing `kaung-portfolio` Neon database, `neondb` —
portfolio tables are untouched):

- `chat_messages` — `id, sender ('kaung'|'love'), body, kind, created_at, read_at`
- `chat_typing` — `sender` (PK), `updated_at`

See `schema.sql` and `scripts/setup-chat-db.mjs`.

## Deploy to Vercel (do this first — the APK loads this site)

1. In Vercel, create a new project from this GitHub repo
   (`Zenn257920/couple-chat`, `main` branch).
2. Set the environment variable **`DATABASE_URL`** for Production,
   Preview **and** Development, using the **pooled** Neon connection
   URI for project `kaung-portfolio` (`green-wind-56000506`, database
   `neondb`, role `neondb_owner`). Get it from the Neon console —
   never commit it to the repo.
3. Deploy. The site should be live at `https://couple-chat.vercel.app`
   (if Vercel gives it a different URL, update `server.url` in
   `capacitor.config.ts`, run `npx cap sync android`, and push again).

## Build the APK (GitHub Actions — no local Android SDK needed)

Every push to `main` runs `.github/workflows/android.yml`: it installs
dependencies, makes sure the Capacitor Android project is complete,
builds with Gradle (`assembleDebug`), and uploads the APK as the artifact
**`kaung-love-apk`** (`app-debug.apk`).

> Note: `android/` in this repo holds the generated project's text files,
> but its binary defaults (launcher/splash PNGs, Gradle wrapper jar)
> are **not** committed — they are regenerated in CI with
> `npx cap add android`. Locally, run `npx cap add android` once to
> generate them (delete `android/` first if it already exists).

1. Open the Actions run on GitHub, download the `kaung-love-apk` artifact.
2. Send the `.apk` file to the other phone (Telegram / Messenger / Drive…).
3. On the phone, tap the file to install. Android will ask to
   **Allow install from unknown apps** for that app — allow it once.
   (Play Protect may show a warning because the app is not from the
   Play Store — that is expected for sideloading; tap Install anyway.)
4. Open the app, pick who is using this phone, and start chatting. 💙

**Note:** the APK is a Capacitor WebView wrapper around the Vercel site
(`server.url` in `capacitor.config.ts`), so it needs internet to show
live messages. The backend lives on Vercel + Neon, not inside the APK.

## Local development

```bash
npm install
# create the chat tables (fetches the Neon URI via the API, never prints it)
python3 scripts/setup-chat-db.py
# or, with DATABASE_URL already in the environment:
# npm run db:setup
npm run dev
```

`npm run build` must pass (`tsc` + `next build`). The app runs without
`DATABASE_URL` for the UI shell, but the API routes need it to load/send
messages.

## Tech

Next.js 15, React 19, TypeScript, Tailwind CSS v4,
`@neondatabase/serverless`, Capacitor 7 (`com.kaung.lovechat`).
