import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// Shared couple settings (key/value) — things both phones must agree
// on, unlike per-phone localStorage. First key: 'together_since'
// (YYYY-MM-DD), the date the live Together counter counts from.
await sql`
  CREATE TABLE IF NOT EXISTS chat_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

console.log("chat_meta table ready");
