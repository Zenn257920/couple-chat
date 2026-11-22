import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// Profile photos: one per person (sender), stored as base64 JPEG
// (client compresses to max 256px first, ~20–50 KB) — same pattern as
// the portfolio photo. Both phones fetch both photos once on load;
// the header shows the other person's photo (💙 fallback).
await sql`
  CREATE TABLE IF NOT EXISTS chat_profiles (
    sender TEXT PRIMARY KEY,
    photo_base64 TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

console.log("chat_profiles table ready");
