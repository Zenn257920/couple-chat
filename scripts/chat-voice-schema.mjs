import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// Voice messages: audio is stored as base64 in the same pattern as the
// portfolio photo (profile.photo_base64). The chat list NEVER selects
// audio_base64 — it is fetched lazily per message via /api/audio, so the
// 1.5s poll stays small. ~1 min of Opus voice is ~200 KB base64.
await sql`
  ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS audio_base64 TEXT,
  ADD COLUMN IF NOT EXISTS audio_duration INTEGER,
  ADD COLUMN IF NOT EXISTS audio_mime TEXT
`;

const c = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'chat_messages'
  AND column_name IN ('audio_base64', 'audio_duration', 'audio_mime')
`;
console.log("voice columns present:", c.map((r) => r.column_name).join(", "));
