import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// Photo messages: base64 JPEG stored like voice audio, but NEVER in
// the message list (fetched lazily per photo via /api/photo, same
// pattern as /api/audio). width/height ride the list so the bubble
// can reserve the right shape.
await sql`
  ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS photo_base64 TEXT,
  ADD COLUMN IF NOT EXISTS photo_width INT,
  ADD COLUMN IF NOT EXISTS photo_height INT
`;

const c = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'chat_messages' AND column_name IN ('photo_base64', 'photo_width', 'photo_height')
`;
console.log("photo columns present:", c.length);
