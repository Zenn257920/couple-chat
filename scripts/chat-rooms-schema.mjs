// Multi-user chat schema: rooms, memberships, friendships, plus
// nullable user/room columns on the old couple-chat tables.
// SAFE to run while the old app is live: it only ADDS tables and
// nullable columns — no existing column, key or row is changed, so
// the old kaung/love code keeps working until the refactor lands.
// Run with: DATABASE_URL=... node scripts/chat-rooms-schema.mjs
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing");
const sql = neon(url);

await sql`
  CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('dm', 'group')),
    name TEXT,
    created_by TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    -- dm_key is the two member ids sorted + joined (DMs only); it
    -- makes "get or create DM" race-safe and prevents duplicate DMs.
    dm_key TEXT UNIQUE,
    -- Only the couple's DM has this (the live Together counter).
    together_since DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
await sql`
  CREATE TABLE IF NOT EXISTS room_members (
    room_id INT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (room_id, user_id)
  )
`;
await sql`
  CREATE TABLE IF NOT EXISTS friendships (
    id SERIAL PRIMARY KEY,
    requester_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    addressee_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (requester_id, addressee_id)
  )
`;

// Nullable backfill columns on the old tables. The old `sender`
// (kaung/love) column stays until the refactor is verified live.
await sql`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS room_id INT REFERENCES rooms(id) ON DELETE CASCADE`;
await sql`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS sender_id TEXT REFERENCES "user"(id) ON DELETE SET NULL`;
await sql`CREATE INDEX IF NOT EXISTS chat_messages_room_id_idx ON chat_messages (room_id, created_at DESC, id DESC)`;
await sql`ALTER TABLE chat_reactions ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES "user"(id) ON DELETE CASCADE`;
await sql`ALTER TABLE chat_presence ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES "user"(id) ON DELETE CASCADE`;
await sql`ALTER TABLE chat_typing ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES "user"(id) ON DELETE CASCADE`;
await sql`ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES "user"(id) ON DELETE CASCADE`;
await sql`ALTER TABLE chat_profiles ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES "user"(id) ON DELETE CASCADE`;

console.log("rooms schema ready: rooms, room_members, friendships + backfill columns");
