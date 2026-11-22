import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// Message editing: only the sender's own TEXT messages can be edited
// (no delete — the user explicitly didn't want it). edited_at marks a
// message as edited; the bubble shows an "edited" label.
await sql`
  ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ
`;

const c = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'chat_messages' AND column_name = 'edited_at'
`;
console.log("edited_at column present:", c.length > 0);
