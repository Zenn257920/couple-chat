// Multi-user chat data layer (Neon HTTP driver).
//
// Identity is now the Better Auth user id (a string). The old
// `sender` columns ('kaung'/'love') still exist — new rows write the
// user id into BOTH `sender` and `sender_id`/`user_id`, and reads use
// COALESCE(sender_id, sender) so rows backfilled by the couple-DM
// migration (sender still 'kaung'/'love', sender_id set) read the
// same way. The `sender` columns are never deleted: the migration
// script backfills from them.
//
// Every message lives in a room (room_id). A user can only see a
// room they are a member of; DMs exist only between accepted
// friends; group members must be the creator's friends.
import { neon } from "@neondatabase/serverless";

export type MessageReaction = {
  emoji: string;
  senders: string[];
};

export type ChatMessage = {
  id: number;
  // Better Auth user id of the sender.
  sender: string;
  body: string;
  kind: string;
  created_at: string;
  read_at: string | null;
  reply_to_id: number | null;
  reply_to: { id: number; sender: string; body: string } | null;
  reactions: MessageReaction[];
  // Voice messages only. audio_base64 is NEVER sent with the list —
  // it is fetched lazily per message via /api/audio, so the 1.5s poll
  // stays small.
  audio_duration: number | null;
  audio_mime: string | null;
  has_audio: boolean;
  // Set when the sender edits their own text message.
  edited_at: string | null;
  // Photo messages only. photo_base64 is NEVER sent with the list —
  // it is fetched lazily per photo via /api/photo, like voice audio.
  photo_width: number | null;
  photo_height: number | null;
  has_photo: boolean;
};

export type TypingState = {
  sender: string;
  updated_at: string;
} | null;

export type RoomUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  // Uploaded profile photo (base64 JPEG) — falls back to `image`
  // (Google avatar) on the client when null.
  photo: string | null;
};

export type RoomSummary = {
  id: number;
  type: "dm" | "group";
  name: string | null;
  together_since: string | null;
  lastMessage: {
    id: number;
    senderId: string;
    body: string;
    kind: string;
    createdAt: string;
  } | null;
  unread: number;
  memberIds: string[];
};

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

// --- Users ---

export async function getRoomUsers(userIds: string[]): Promise<RoomUser[]> {
  if (!userIds.length) return [];
  const sql = getSql();
  const rows = await sql`
    SELECT u.id, u.name, u.email, u.image,
      (SELECT photo_base64 FROM chat_profiles
       WHERE user_id = u.id OR sender = u.id
       ORDER BY updated_at DESC LIMIT 1) AS photo
    FROM "user" u
    WHERE u.id = ANY(${userIds})
  `;
  return rows as unknown as RoomUser[];
}

export async function getUserByEmail(
  email: string,
): Promise<RoomUser | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT u.id, u.name, u.email, u.image,
      (SELECT photo_base64 FROM chat_profiles
       WHERE user_id = u.id OR sender = u.id
       ORDER BY updated_at DESC LIMIT 1) AS photo
    FROM "user" u
    WHERE lower(u.email) = lower(${email})
    LIMIT 1
  `;
  if (!rows.length) return null;
  return rows[0] as unknown as RoomUser;
}

// --- Rooms ---

export async function isRoomMember(
  roomId: number,
  userId: string,
): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    SELECT 1 FROM room_members
    WHERE room_id = ${roomId} AND user_id = ${userId}
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function getRoomMemberIds(roomId: number): Promise<string[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT user_id FROM room_members WHERE room_id = ${roomId}
  `;
  return (rows as unknown as { user_id: string }[]).map((r) => r.user_id);
}

export async function getRoom(
  roomId: number,
): Promise<{
  id: number;
  type: "dm" | "group";
  name: string | null;
  created_by: string;
  together_since: string | null;
} | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, type, name, created_by, together_since
    FROM rooms WHERE id = ${roomId}
  `;
  if (!rows.length) return null;
  const row = rows[0] as unknown as {
    id: number;
    type: "dm" | "group";
    name: string | null;
    created_by: string;
    together_since: string | null;
  };
  return {
    ...row,
    together_since: row.together_since
      ? String(row.together_since).slice(0, 10)
      : null,
  };
}

export async function getRoomsForUser(userId: string): Promise<RoomSummary[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT r.id, r.type, r.name, r.together_since,
      (SELECT m.id FROM chat_messages m WHERE m.room_id = r.id
       ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_id,
      (SELECT COALESCE(m.sender_id, m.sender) FROM chat_messages m
       WHERE m.room_id = r.id
       ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_sender_id,
      (SELECT m.body FROM chat_messages m WHERE m.room_id = r.id
       ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_body,
      (SELECT m.kind FROM chat_messages m WHERE m.room_id = r.id
       ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_kind,
      (SELECT m.created_at FROM chat_messages m WHERE m.room_id = r.id
       ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_created_at,
      (SELECT count(*) FROM chat_messages m WHERE m.room_id = r.id
       AND m.sender_id <> ${userId} AND m.read_at IS NULL) AS unread,
      (SELECT array_agg(rm.user_id) FROM room_members rm
       WHERE rm.room_id = r.id) AS member_ids,
      (SELECT max(m.created_at) FROM chat_messages m
       WHERE m.room_id = r.id) AS last_activity
    FROM rooms r
    JOIN room_members me ON me.room_id = r.id AND me.user_id = ${userId}
    ORDER BY last_activity DESC NULLS LAST, r.created_at DESC
  `;
  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    id: r.id as number,
    type: r.type as "dm" | "group",
    name: r.name as string | null,
    together_since: r.together_since
      ? String(r.together_since).slice(0, 10)
      : null,
    lastMessage:
      r.last_id == null
        ? null
        : {
            id: r.last_id as number,
            senderId: r.last_sender_id as string,
            body: r.last_body as string,
            kind: r.last_kind as string,
            createdAt: new Date(
              r.last_created_at as string,
            ).toISOString(),
          },
    unread: Number(r.unread ?? 0),
    memberIds: (r.member_ids as string[] | null) ?? [],
  }));
}

// Get-or-create a DM with a friend. Throws when the two are not
// accepted friends. dm_key (sorted ids) makes this race-safe and
// prevents duplicate DMs.
export async function getOrCreateDM(
  userId: string,
  friendId: string,
): Promise<{ id: number; type: "dm" | "group"; name: string | null; together_since: string | null }> {
  if (!(await areFriends(userId, friendId))) {
    throw new Error("not friends");
  }
  const sql = getSql();
  const dmKey = [userId, friendId].sort().join(":");
  const inserted = await sql`
    INSERT INTO rooms (type, created_by, dm_key)
    VALUES ('dm', ${userId}, ${dmKey})
    ON CONFLICT (dm_key) DO NOTHING
    RETURNING id
  `;
  let roomId: number;
  if (inserted.length) {
    roomId = (inserted[0] as unknown as { id: number }).id;
  } else {
    const found = await sql`
      SELECT id FROM rooms WHERE dm_key = ${dmKey}
    `;
    roomId = (found[0] as unknown as { id: number }).id;
  }
  await sql`
    INSERT INTO room_members (room_id, user_id)
    VALUES (${roomId}, ${userId}), (${roomId}, ${friendId})
    ON CONFLICT DO NOTHING
  `;
  const room = await getRoom(roomId);
  if (!room) throw new Error("DM room not found");
  return room;
}

// Create a group chat. Every member must already be an accepted
// friend of the creator — strangers can't be pulled into a group.
export async function createGroup(
  userId: string,
  name: string,
  memberIds: string[],
): Promise<{ id: number; type: "dm" | "group"; name: string | null; together_since: string | null }> {
  const cleanName = name.trim();
  if (!cleanName || cleanName.length > 100) {
    throw new Error("invalid name");
  }
  const members = [...new Set(memberIds.filter((id) => id && id !== userId))];
  if (!members.length) throw new Error("no members");
  const sql = getSql();
  const friendCount = await sql`
    SELECT count(*) AS n FROM friendships
    WHERE status = 'accepted' AND (
      (requester_id = ${userId} AND addressee_id = ANY(${members})) OR
      (requester_id = ANY(${members}) AND addressee_id = ${userId})
    )
  `;
  if (Number((friendCount[0] as unknown as { n: string }).n) !== members.length) {
    throw new Error("not all members are friends");
  }
  const inserted = await sql`
    INSERT INTO rooms (type, name, created_by)
    VALUES ('group', ${cleanName}, ${userId})
    RETURNING id
  `;
  const roomId = (inserted[0] as unknown as { id: number }).id;
  const all = [userId, ...members];
  await sql`
    INSERT INTO room_members (room_id, user_id)
    SELECT ${roomId}, unnest(${all}::text[])
    ON CONFLICT DO NOTHING
  `;
  const room = await getRoom(roomId);
  if (!room) throw new Error("group room not found");
  return room;
}

// --- Friends ---

export async function areFriends(a: string, b: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    SELECT 1 FROM friendships
    WHERE status = 'accepted' AND (
      (requester_id = ${a} AND addressee_id = ${b}) OR
      (requester_id = ${b} AND addressee_id = ${a})
    )
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function listFriends(userId: string): Promise<RoomUser[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT u.id, u.name, u.email, u.image,
      (SELECT photo_base64 FROM chat_profiles
       WHERE user_id = u.id OR sender = u.id
       ORDER BY updated_at DESC LIMIT 1) AS photo
    FROM friendships f
    JOIN "user" u ON u.id = CASE
      WHEN f.requester_id = ${userId} THEN f.addressee_id
      ELSE f.requester_id END
    WHERE (f.requester_id = ${userId} OR f.addressee_id = ${userId})
      AND f.status = 'accepted'
    ORDER BY u.name
  `;
  return rows as unknown as RoomUser[];
}

export async function listFriendRequests(userId: string): Promise<{
  incoming: RoomUser[];
  outgoing: RoomUser[];
}> {
  const sql = getSql();
  const [incoming, outgoing] = await Promise.all([
    sql`
      SELECT u.id, u.name, u.email, u.image,
        (SELECT photo_base64 FROM chat_profiles
         WHERE user_id = u.id OR sender = u.id
         ORDER BY updated_at DESC LIMIT 1) AS photo
      FROM friendships f
      JOIN "user" u ON u.id = f.requester_id
      WHERE f.addressee_id = ${userId} AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `,
    sql`
      SELECT u.id, u.name, u.email, u.image,
        (SELECT photo_base64 FROM chat_profiles
         WHERE user_id = u.id OR sender = u.id
         ORDER BY updated_at DESC LIMIT 1) AS photo
      FROM friendships f
      JOIN "user" u ON u.id = f.addressee_id
      WHERE f.requester_id = ${userId} AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `,
  ]);
  return {
    incoming: incoming as unknown as RoomUser[],
    outgoing: outgoing as unknown as RoomUser[],
  };
}

// Send a friend request. If they already requested you, the two
// requests collapse into an accepted friendship. Returns the
// outcome: 'pending' | 'accepted' | 'already'. Throws on self-add,
// an existing accepted friendship, or a block.
export async function sendFriendRequest(
  requesterId: string,
  addresseeId: string,
): Promise<"pending" | "accepted" | "already"> {
  if (requesterId === addresseeId) throw new Error("cannot add yourself");
  const sql = getSql();
  const existing = await sql`
    SELECT requester_id, status FROM friendships
    WHERE (requester_id = ${requesterId} AND addressee_id = ${addresseeId})
       OR (requester_id = ${addresseeId} AND addressee_id = ${requesterId})
    LIMIT 1
  `;
  if (existing.length) {
    const row = existing[0] as unknown as {
      requester_id: string;
      status: string;
    };
    if (row.status === "accepted") return "already";
    if (row.status === "blocked") throw new Error("blocked");
    // Pending from them to me: accept it instead of a second request.
    if (row.requester_id === addresseeId) {
      await sql`
        UPDATE friendships SET status = 'accepted', updated_at = now()
        WHERE requester_id = ${addresseeId} AND addressee_id = ${requesterId}
      `;
      return "accepted";
    }
    return "pending";
  }
  await sql`
    INSERT INTO friendships (requester_id, addressee_id, status)
    VALUES (${requesterId}, ${addresseeId}, 'pending')
  `;
  return "pending";
}

// Accept (or decline) an incoming request. Only the addressee can
// respond. Decline deletes the request.
export async function respondFriendRequest(
  userId: string,
  requesterId: string,
  accept: boolean,
): Promise<void> {
  const sql = getSql();
  if (accept) {
    const rows = await sql`
      UPDATE friendships SET status = 'accepted', updated_at = now()
      WHERE requester_id = ${requesterId} AND addressee_id = ${userId}
        AND status = 'pending'
      RETURNING id
    `;
    if (!rows.length) throw new Error("request not found");
  } else {
    const rows = await sql`
      DELETE FROM friendships
      WHERE requester_id = ${requesterId} AND addressee_id = ${userId}
        AND status = 'pending'
      RETURNING id
    `;
    if (!rows.length) throw new Error("request not found");
  }
}

export type UserSearchResult = RoomUser & {
  friendship_status: string | null;
  // Who sent the pending request, when one exists.
  friendship_requester: string | null;
};

export async function searchUsers(
  userId: string,
  q: string,
): Promise<UserSearchResult[]> {
  const sql = getSql();
  const like = `%${q}%`;
  const rows = await sql`
    SELECT u.id, u.name, u.email, u.image,
      (SELECT photo_base64 FROM chat_profiles
       WHERE user_id = u.id OR sender = u.id
       ORDER BY updated_at DESC LIMIT 1) AS photo,
      f.status AS friendship_status,
      f.requester_id AS friendship_requester
    FROM "user" u
    LEFT JOIN friendships f ON
      (f.requester_id = ${userId} AND f.addressee_id = u.id) OR
      (f.requester_id = u.id AND f.addressee_id = ${userId})
    WHERE u.id <> ${userId}
      AND (u.name ILIKE ${like} OR u.email ILIKE ${like})
    ORDER BY u.name
    LIMIT 10
  `;
  return rows as unknown as UserSearchResult[];
}

// --- Messages (room-scoped) ---

export async function getMessages(
  roomId: number,
  limit = 200,
): Promise<ChatMessage[]> {
  const sql = getSql();
  // Return the NEWEST `limit` messages, oldest-first for display.
  const rows = await sql`
    SELECT id, sender, body, kind, created_at, read_at, reply_to_id,
      audio_duration, audio_mime, has_audio, edited_at,
      photo_width, photo_height, has_photo
    FROM (
      SELECT id, COALESCE(sender_id, sender) AS sender, body, kind,
        created_at, read_at, reply_to_id,
        audio_duration, audio_mime, (audio_base64 IS NOT NULL) AS has_audio,
        edited_at,
        photo_width, photo_height, (photo_base64 IS NOT NULL) AS has_photo
      FROM chat_messages
      WHERE room_id = ${roomId}
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit}
    ) AS recent
    ORDER BY created_at ASC, id ASC
  `;
  const messages = rows as unknown as ChatMessage[];
  if (!messages.length) return messages;
  const ids = messages.map((m) => m.id);
  const replyIds = [...new Set(messages.map((m) => m.reply_to_id).filter((x): x is number => x !== null))];
  const [reactionRows, replyRows] = await Promise.all([
    sql`SELECT message_id, COALESCE(user_id, sender) AS sender, emoji, created_at FROM chat_reactions WHERE message_id = ANY(${ids}) ORDER BY created_at ASC`,
    replyIds.length
      ? sql`SELECT id, COALESCE(sender_id, sender) AS sender, body FROM chat_messages WHERE id = ANY(${replyIds})`
      : Promise.resolve([] as unknown[]),
  ]);
  const replyById = new Map(
    (replyRows as unknown as { id: number; sender: string; body: string }[]).map((r) => [r.id, r]),
  );
  const reactionsByMessage = new Map<number, MessageReaction[]>();
  for (const r of reactionRows as unknown as { message_id: number; sender: string; emoji: string }[]) {
    const list = reactionsByMessage.get(r.message_id) ?? [];
    const group = list.find((g) => g.emoji === r.emoji);
    if (group) group.senders.push(r.sender);
    else list.push({ emoji: r.emoji, senders: [r.sender] });
    reactionsByMessage.set(r.message_id, list);
  }
  for (const m of messages) {
    m.reply_to = m.reply_to_id ? (replyById.get(m.reply_to_id) ?? null) : null;
    m.reactions = reactionsByMessage.get(m.id) ?? [];
  }
  return messages;
}

export type VoiceData = {
  audioBase64: string;
  audioDuration: number;
  audioMime: string;
};

export type PhotoData = {
  photoBase64: string;
  photoWidth: number;
  photoHeight: number;
};

export async function insertMessage(
  userId: string,
  roomId: number,
  body: string,
  replyToId?: number | null,
  voice?: VoiceData | null,
  photo?: PhotoData | null,
): Promise<ChatMessage> {
  const sql = getSql();
  // Only link the reply when the quoted message really exists in
  // this room.
  let replyTo: number | null = null;
  if (typeof replyToId === "number" && Number.isInteger(replyToId) && replyToId > 0) {
    const target = await sql`SELECT id FROM chat_messages WHERE id = ${replyToId} AND room_id = ${roomId}`;
    if (target.length) replyTo = replyToId;
  }
  const kind = photo ? "photo" : voice ? "voice" : "text";
  const rows = await sql`
    INSERT INTO chat_messages (sender, sender_id, room_id, body, kind, reply_to_id, audio_base64, audio_duration, audio_mime, photo_base64, photo_width, photo_height)
    VALUES (${userId}, ${userId}, ${roomId}, ${body}, ${kind}, ${replyTo}, ${voice?.audioBase64 ?? null}, ${voice?.audioDuration ?? null}, ${voice?.audioMime ?? null}, ${photo?.photoBase64 ?? null}, ${photo?.photoWidth ?? null}, ${photo?.photoHeight ?? null})
    RETURNING id, COALESCE(sender_id, sender) AS sender, body, kind, created_at, read_at, reply_to_id,
      audio_duration, audio_mime, (audio_base64 IS NOT NULL) AS has_audio,
      edited_at,
      photo_width, photo_height, (photo_base64 IS NOT NULL) AS has_photo
  `;
  const message = rows[0] as unknown as ChatMessage;
  message.reactions = [];
  message.reply_to = null;
  if (replyTo) {
    const target = await sql`SELECT id, COALESCE(sender_id, sender) AS sender, body FROM chat_messages WHERE id = ${replyTo}`;
    if (target.length) message.reply_to = target[0] as unknown as ChatMessage["reply_to"];
  }
  return message;
}

// Edit your own TEXT message (no delete — the user didn't want it).
// Returns the updated message, or null when the message doesn't
// exist, isn't yours, or isn't text.
export async function updateMessage(
  messageId: number,
  userId: string,
  body: string,
): Promise<ChatMessage | null> {
  const sql = getSql();
  const rows = await sql`
    UPDATE chat_messages
    SET body = ${body}, edited_at = now()
    WHERE id = ${messageId} AND sender_id = ${userId} AND kind = 'text'
    RETURNING id, COALESCE(sender_id, sender) AS sender, body, kind, created_at, read_at, reply_to_id,
      audio_duration, audio_mime, (audio_base64 IS NOT NULL) AS has_audio,
      edited_at,
      photo_width, photo_height, (photo_base64 IS NOT NULL) AS has_photo
  `;
  if (!rows.length) return null;
  const message = rows[0] as unknown as ChatMessage;
  message.reactions = [];
  message.reply_to = null;
  if (message.reply_to_id) {
    const target = await sql`SELECT id, COALESCE(sender_id, sender) AS sender, body FROM chat_messages WHERE id = ${message.reply_to_id}`;
    if (target.length) message.reply_to = target[0] as unknown as ChatMessage["reply_to"];
  }
  const reactionRows = await sql`
    SELECT COALESCE(user_id, sender) AS sender, emoji FROM chat_reactions WHERE message_id = ${messageId}
  `;
  for (const r of reactionRows as unknown as { sender: string; emoji: string }[]) {
    const group = message.reactions.find((g) => g.emoji === r.emoji);
    if (group) group.senders.push(r.sender);
    else message.reactions.push({ emoji: r.emoji, senders: [r.sender] });
  }
  return message;
}

// Which room a message belongs to (for access checks on lazy
// audio/photo fetches and reactions).
export async function getMessageRoom(messageId: number): Promise<number | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT room_id FROM chat_messages WHERE id = ${messageId}
  `;
  if (!rows.length) return null;
  return (rows[0] as unknown as { room_id: number | null }).room_id;
}

// Fetch one photo message's image (lazy — never part of the list).
export async function getPhoto(
  messageId: number,
): Promise<{ photoBase64: string } | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT photo_base64
    FROM chat_messages
    WHERE id = ${messageId} AND photo_base64 IS NOT NULL
  `;
  if (!rows.length) return null;
  return { photoBase64: (rows[0] as unknown as { photo_base64: string }).photo_base64 };
}

// --- Together counter (per room, not global) ---

export async function getTogetherDate(roomId: number): Promise<string | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT together_since FROM rooms WHERE id = ${roomId}
  `;
  if (!rows.length) return null;
  const v = (rows[0] as unknown as { together_since: string | null }).together_since;
  return v ? String(v).slice(0, 10) : null;
}

// Only a DM that already has a date (the couple's DM) can have its
// date changed or cleared. Other rooms never get a counter.
export async function setTogetherDate(
  roomId: number,
  userId: string,
  date: string | null,
): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    UPDATE rooms SET together_since = ${date}
    WHERE id = ${roomId} AND type = 'dm' AND together_since IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM room_members
        WHERE room_id = ${roomId} AND user_id = ${userId}
      )
    RETURNING id
  `;
  return rows.length > 0;
}

// --- Online / last-seen presence (per user, not per room) ---

export async function setPresence(userId: string): Promise<void> {
  const sql = getSql();
  // Drop any stale row the migration left under the old 'kaung' /
  // 'love' sender id, so a user has exactly one presence row.
  await sql`
    DELETE FROM chat_presence
    WHERE user_id = ${userId} AND sender <> ${userId}
  `;
  await sql`
    INSERT INTO chat_presence (sender, user_id, last_seen)
    VALUES (${userId}, ${userId}, now())
    ON CONFLICT (sender) DO UPDATE SET last_seen = now(), user_id = EXCLUDED.user_id
  `;
}

export async function getPresence(
  userIds: string[],
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const id of userIds) out[id] = null;
  if (!userIds.length) return out;
  const sql = getSql();
  const rows = await sql`
    SELECT COALESCE(user_id, sender) AS user_id, last_seen
    FROM chat_presence
    WHERE user_id = ANY(${userIds}) OR sender = ANY(${userIds})
  `;
  for (const r of rows as unknown as { user_id: string; last_seen: string }[]) {
    // Keep the newest heartbeat when a stale duplicate exists.
    if (!out[r.user_id] || new Date(r.last_seen) > new Date(out[r.user_id]!)) {
      out[r.user_id] = r.last_seen;
    }
  }
  return out;
}

// --- Profile photos (one per user, base64 JPEG) ---

export async function getProfilePhotos(
  userIds: string[],
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const id of userIds) out[id] = null;
  if (!userIds.length) return out;
  const sql = getSql();
  const rows = await sql`
    SELECT COALESCE(user_id, sender) AS user_id, photo_base64
    FROM chat_profiles
    WHERE user_id = ANY(${userIds}) OR sender = ANY(${userIds})
  `;
  for (const r of rows as unknown as { user_id: string; photo_base64: string | null }[]) {
    out[r.user_id] = r.photo_base64;
  }
  return out;
}

export async function setProfilePhoto(
  userId: string,
  photoBase64: string | null,
): Promise<void> {
  const sql = getSql();
  // One row per user: drop any stale row the migration left under
  // the old 'kaung' / 'love' sender id first.
  await sql`
    DELETE FROM chat_profiles
    WHERE user_id = ${userId} AND sender <> ${userId}
  `;
  await sql`
    INSERT INTO chat_profiles (sender, user_id, photo_base64, updated_at)
    VALUES (${userId}, ${userId}, ${photoBase64}, now())
    ON CONFLICT (sender) DO UPDATE
      SET photo_base64 = EXCLUDED.photo_base64,
          user_id = EXCLUDED.user_id,
          updated_at = now()
  `;
}

// Fetch one voice message's audio (lazy — never part of the list).
export async function getAudio(
  messageId: number,
): Promise<{ audioBase64: string; audioMime: string; audioDuration: number } | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT audio_base64, audio_mime, audio_duration
    FROM chat_messages
    WHERE id = ${messageId} AND audio_base64 IS NOT NULL
  `;
  if (!rows.length) return null;
  const r = rows[0] as unknown as {
    audio_base64: string;
    audio_mime: string;
    audio_duration: number;
  };
  return {
    audioBase64: r.audio_base64,
    audioMime: r.audio_mime,
    audioDuration: r.audio_duration,
  };
}

// Toggle a reaction: same emoji again removes it, another emoji
// replaces it (one reaction per person per message, like Telegram).
// Returns true when the reaction is now set, false when removed.
// A row the migration left under the old sender id is collapsed
// into the user's row on first toggle.
export async function toggleReaction(
  messageId: number,
  userId: string,
  emoji: string,
): Promise<boolean> {
  const sql = getSql();
  const existing = await sql`
    SELECT id, COALESCE(user_id, sender) AS user_id, emoji
    FROM chat_reactions
    WHERE message_id = ${messageId}
      AND (sender = ${userId} OR user_id = ${userId})
    LIMIT 1
  `;
  if (existing.length) {
    const row = existing[0] as unknown as {
      id: number;
      emoji: string;
    };
    if (row.emoji === emoji) {
      await sql`DELETE FROM chat_reactions WHERE id = ${row.id}`;
      return false;
    }
    await sql`
      UPDATE chat_reactions
      SET emoji = ${emoji}, sender = ${userId}, user_id = ${userId}, created_at = now()
      WHERE id = ${row.id}
    `;
    return true;
  }
  await sql`
    INSERT INTO chat_reactions (message_id, sender, user_id, emoji)
    VALUES (${messageId}, ${userId}, ${userId}, ${emoji})
    ON CONFLICT (message_id, sender)
    DO UPDATE SET emoji = EXCLUDED.emoji, user_id = EXCLUDED.user_id, created_at = now()
  `;
  return true;
}

// Typing is per room: who is typing in this room right now.
export async function getTyping(roomId: number): Promise<TypingState> {
  const sql = getSql();
  // Typing is only "live" for 5 seconds after the last keystroke ping.
  const rows = await sql`
    SELECT COALESCE(user_id, sender) AS sender, updated_at FROM chat_typing
    WHERE room_id = ${roomId}
      AND updated_at > now() - interval '5 seconds'
    ORDER BY updated_at DESC LIMIT 1
  `;
  if (!rows.length) return null;
  return rows[0] as unknown as TypingState;
}

export async function setTyping(roomId: number, userId: string): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO chat_typing (room_id, user_id, sender, updated_at)
    VALUES (${roomId}, ${userId}, ${userId}, now())
    ON CONFLICT (room_id, user_id) DO UPDATE SET updated_at = now()
  `;
}

export async function markRead(roomId: number, userId: string): Promise<void> {
  // Mark messages sent by others in this room as read for this user.
  // In a DM this is exact; in a group read_at means "read by at
  // least one other member" (per-member read state is a later step).
  const sql = getSql();
  await sql`
    UPDATE chat_messages
    SET read_at = now()
    WHERE room_id = ${roomId} AND sender_id <> ${userId} AND read_at IS NULL
  `;
}

// --- Push notification device tokens (FCM), per user ---

export async function registerPushToken(
  userId: string,
  token: string,
): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO push_tokens (sender, user_id, token)
    VALUES (${userId}, ${userId}, ${token})
    ON CONFLICT (token) DO UPDATE
      SET sender = EXCLUDED.sender, user_id = EXCLUDED.user_id, updated_at = now()
  `;
}

export async function getPushTokensForUsers(userIds: string[]): Promise<string[]> {
  if (!userIds.length) return [];
  const sql = getSql();
  const rows = await sql`
    SELECT token FROM push_tokens WHERE user_id = ANY(${userIds})
  `;
  return (rows as unknown as { token: string }[]).map((r) => r.token);
}

export async function deletePushToken(token: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM push_tokens WHERE token = ${token}`;
}
