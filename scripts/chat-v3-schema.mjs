import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// Telegram-style reactions: one reaction per person per message.
// Tapping the same emoji again removes it; tapping another replaces it.
await sql`
  CREATE TABLE IF NOT EXISTS chat_reactions (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    sender TEXT NOT NULL,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (message_id, sender)
  )
`;
await sql`CREATE INDEX IF NOT EXISTS chat_reactions_message_idx ON chat_reactions (message_id)`;

// Replies: a message can quote one earlier message.
await sql`
  ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS reply_to_id INTEGER REFERENCES chat_messages(id) ON DELETE SET NULL
`;

const r = await sql`SELECT count(*)::int AS n FROM chat_reactions`;
const c = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'reply_to_id'`;
console.log("chat_reactions ready, rows:", r[0].n);
console.log("reply_to_id column:", c.length ? "present" : "MISSING");
