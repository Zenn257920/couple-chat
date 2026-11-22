import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// Online / last-seen presence: each phone heartbeats its last_seen
// every 10s while the app is open. The other phone's header shows
// "Online" (seen < 20s ago) or "Last seen HH:MM".
await sql`
  CREATE TABLE IF NOT EXISTS chat_presence (
    sender TEXT PRIMARY KEY,
    last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

console.log("chat_presence table ready");
