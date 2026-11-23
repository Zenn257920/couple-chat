// Phase-B migration: move the couple's old messages into their
// private DM room, once both of them have accounts.
// Usage: node scripts/chat-migrate-couple-dm.mjs <kaung-email> <love-email>
//   1. Resolves both emails to Better Auth user ids.
//   2. Creates the DM room (dm_key = sorted ids) with together_since
//      taken from chat_meta, and adds both as members.
//   3. Backfills chat_messages (sender kaung/love -> sender_id, room_id),
//      chat_reactions / presence / typing / push_tokens / profiles
//      (sender -> user_id).
//   4. Creates their accepted friendship.
// Idempotent: safe to re-run (ON CONFLICT / WHERE guards everywhere).
// Run with: DATABASE_URL=... node scripts/chat-migrate-couple-dm.mjs <kaung-email> <love-email>
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing");
const [kaungEmail, loveEmail] = process.argv.slice(2);
if (!kaungEmail || !loveEmail) {
  throw new Error("usage: chat-migrate-couple-dm.mjs <kaung-email> <love-email>");
}
const sql = neon(url);

const users = await sql`
  SELECT id, email FROM "user" WHERE email IN (${kaungEmail}, ${loveEmail})
`;
const kaung = users.find((u) => u.email === kaungEmail);
const love = users.find((u) => u.email === loveEmail);
if (!kaung) throw new Error(`no account for ${kaungEmail} — sign up first`);
if (!love) throw new Error(`no account for ${loveEmail} — sign up first`);
const kaungId = kaung.id;
const loveId = love.id;
console.log("kaung:", kaungId, "love:", loveId);

const dmKey = [kaungId, loveId].sort().join(":");
const meta = await sql`SELECT value FROM chat_meta WHERE key = 'together_since'`;
const togetherSince = meta[0]?.value ?? null;

const rooms = await sql`
  INSERT INTO rooms (type, created_by, dm_key, together_since)
  VALUES ('dm', ${kaungId}, ${dmKey}, ${togetherSince})
  ON CONFLICT (dm_key) DO UPDATE SET together_since = EXCLUDED.together_since
  RETURNING id
`;
const roomId = rooms[0].id;
console.log("DM room:", roomId, "together_since:", togetherSince);

await sql`
  INSERT INTO room_members (room_id, user_id) VALUES (${roomId}, ${kaungId}), (${roomId}, ${loveId})
  ON CONFLICT DO NOTHING
`;
await sql`
  INSERT INTO friendships (requester_id, addressee_id, status)
  VALUES (${kaungId}, ${loveId}, 'accepted')
  ON CONFLICT (requester_id, addressee_id) DO UPDATE SET status = 'accepted', updated_at = now()
`;

// Backfill the old rows (only rows that still point at the old ids).
// Explicit statements — the Neon driver cannot interpolate table or
// column names, so no dynamic identifiers here.
const msg = await sql`
  UPDATE chat_messages
  SET room_id = ${roomId},
      sender_id = CASE sender WHEN 'kaung' THEN ${kaungId} WHEN 'love' THEN ${loveId} ELSE sender_id END
  WHERE room_id IS NULL AND sender IN ('kaung', 'love')
  RETURNING id
`;
console.log("messages moved:", msg.length);
const backfills = [
  ["chat_reactions", await sql`UPDATE chat_reactions SET user_id = CASE sender WHEN 'kaung' THEN ${kaungId} WHEN 'love' THEN ${loveId} ELSE user_id END WHERE user_id IS NULL AND sender IN ('kaung', 'love') RETURNING id`],
  ["chat_presence", await sql`UPDATE chat_presence SET user_id = CASE sender WHEN 'kaung' THEN ${kaungId} WHEN 'love' THEN ${loveId} ELSE user_id END WHERE user_id IS NULL AND sender IN ('kaung', 'love') RETURNING id`],
  ["chat_typing", await sql`UPDATE chat_typing SET user_id = CASE sender WHEN 'kaung' THEN ${kaungId} WHEN 'love' THEN ${loveId} ELSE user_id END WHERE user_id IS NULL AND sender IN ('kaung', 'love') RETURNING id`],
  ["push_tokens", await sql`UPDATE push_tokens SET user_id = CASE sender WHEN 'kaung' THEN ${kaungId} WHEN 'love' THEN ${loveId} ELSE user_id END WHERE user_id IS NULL AND sender IN ('kaung', 'love') RETURNING id`],
  ["chat_profiles", await sql`UPDATE chat_profiles SET user_id = CASE sender WHEN 'kaung' THEN ${kaungId} WHEN 'love' THEN ${loveId} ELSE user_id END WHERE user_id IS NULL AND sender IN ('kaung', 'love') RETURNING id`],
];
for (const [table, rows] of backfills) {
  console.log(table, "backfilled:", rows.length);
}
console.log("couple DM migration done — room", roomId);
