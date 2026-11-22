import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
await sql`
  CREATE TABLE IF NOT EXISTS push_tokens (
    id SERIAL PRIMARY KEY,
    sender TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
const rows = await sql`SELECT count(*)::int AS n FROM push_tokens`;
console.log("push_tokens ready, rows:", rows[0].n);
