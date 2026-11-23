// Multi-user schema delta: lets the sender columns hold Better Auth
// user ids (the old CHECKs only allowed 'kaung'/'love'), and makes
// typing per-room (room_id, user_id) instead of one row per person.
// SAFE: only drops CHECKs / restructures the ephemeral typing table
// (its 2 rows are stale — typing expires after 5s). The `sender`
// columns are KEPT so scripts/chat-migrate-couple-dm.mjs can still
// backfill user_id from them. Run with:
//   DATABASE_URL=... node scripts/chat-multiuser-schema.mjs
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing");
const sql = neon(url);

// Senders are now Better Auth user ids, not 'kaung'/'love'.
await sql`ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_sender_check`;
await sql`ALTER TABLE chat_typing DROP CONSTRAINT IF EXISTS chat_typing_sender_check`;

// Typing is per room now: one row per (room, user). The old table
// held one row per person globally.
await sql`DELETE FROM chat_typing`;
await sql`ALTER TABLE chat_typing ADD COLUMN IF NOT EXISTS room_id INT REFERENCES rooms(id) ON DELETE CASCADE`;
await sql`ALTER TABLE chat_typing DROP CONSTRAINT IF EXISTS chat_typing_pkey`;
await sql`ALTER TABLE chat_typing ALTER COLUMN room_id SET NOT NULL`;
await sql`ALTER TABLE chat_typing ALTER COLUMN user_id SET NOT NULL`;
await sql`ALTER TABLE chat_typing ADD PRIMARY KEY (room_id, user_id)`;
await sql`CREATE INDEX IF NOT EXISTS chat_typing_room_idx ON chat_typing (room_id, updated_at DESC)`;

console.log("multi-user schema delta done");
