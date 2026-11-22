import { neon } from "@neondatabase/serverless";
import type { Sender } from "./names";

export type MessageReaction = {
  emoji: string;
  senders: Sender[];
};

export type ChatMessage = {
  id: number;
  sender: Sender;
  body: string;
  kind: string;
  created_at: string;
  read_at: string | null;
  reply_to_id: number | null;
  reply_to: { id: number; sender: Sender; body: string } | null;
  reactions: MessageReaction[];
  // Voice messages only. audio_base64 is NEVER sent with the list —
  // it is fetched lazily per message via /api/audio, so the 1.5s poll
  // stays small.
  audio_duration: number | null;
  audio_mime: string | null;
  has_audio: boolean;
};

export type TypingState = {
  sender: Sender;
  updated_at: string;
} | null;

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

export async function getMessages(limit = 200): Promise<ChatMessage[]> {
  const sql = getSql();
  // Return the NEWEST `limit` messages, oldest-first for display. The
  // previous version took the OLDEST `limit` rows, so once the chat
  // passed 200 messages new ones never loaded in the app (they still
  // arrived via push, whose text comes straight from the POST).
  const rows = await sql`
    SELECT id, sender, body, kind, created_at, read_at, reply_to_id,
      audio_duration, audio_mime, has_audio
    FROM (
      SELECT id, sender, body, kind, created_at, read_at, reply_to_id,
        audio_duration, audio_mime, (audio_base64 IS NOT NULL) AS has_audio
      FROM chat_messages
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
    sql`SELECT message_id, sender, emoji, created_at FROM chat_reactions WHERE message_id = ANY(${ids}) ORDER BY created_at ASC`,
    replyIds.length
      ? sql`SELECT id, sender, body FROM chat_messages WHERE id = ANY(${replyIds})`
      : Promise.resolve([] as unknown[]),
  ]);
  const replyById = new Map(
    (replyRows as unknown as { id: number; sender: Sender; body: string }[]).map((r) => [r.id, r]),
  );
  const reactionsByMessage = new Map<number, MessageReaction[]>();
  for (const r of reactionRows as unknown as { message_id: number; sender: Sender; emoji: string }[]) {
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

export async function insertMessage(
  sender: Sender,
  body: string,
  replyToId?: number | null,
  voice?: VoiceData | null,
): Promise<ChatMessage> {
  const sql = getSql();
  // Only link the reply when the quoted message really exists.
  let replyTo: number | null = null;
  if (typeof replyToId === "number" && Number.isInteger(replyToId) && replyToId > 0) {
    const target = await sql`SELECT id FROM chat_messages WHERE id = ${replyToId}`;
    if (target.length) replyTo = replyToId;
  }
  const kind = voice ? "voice" : "text";
  const rows = await sql`
    INSERT INTO chat_messages (sender, body, kind, reply_to_id, audio_base64, audio_duration, audio_mime)
    VALUES (${sender}, ${body}, ${kind}, ${replyTo}, ${voice?.audioBase64 ?? null}, ${voice?.audioDuration ?? null}, ${voice?.audioMime ?? null})
    RETURNING id, sender, body, kind, created_at, read_at, reply_to_id,
      audio_duration, audio_mime, (audio_base64 IS NOT NULL) AS has_audio
  `;
  const message = rows[0] as unknown as ChatMessage;
  message.reactions = [];
  message.reply_to = null;
  if (replyTo) {
    const target = await sql`SELECT id, sender, body FROM chat_messages WHERE id = ${replyTo}`;
    if (target.length) message.reply_to = target[0] as unknown as ChatMessage["reply_to"];
  }
  return message;
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
export async function toggleReaction(
  messageId: number,
  sender: Sender,
  emoji: string,
): Promise<boolean> {
  const sql = getSql();
  const existing = await sql`
    SELECT emoji FROM chat_reactions
    WHERE message_id = ${messageId} AND sender = ${sender}
  `;
  if (existing.length && (existing[0] as unknown as { emoji: string }).emoji === emoji) {
    await sql`
      DELETE FROM chat_reactions
      WHERE message_id = ${messageId} AND sender = ${sender}
    `;
    return false;
  }
  await sql`
    INSERT INTO chat_reactions (message_id, sender, emoji)
    VALUES (${messageId}, ${sender}, ${emoji})
    ON CONFLICT (message_id, sender)
    DO UPDATE SET emoji = EXCLUDED.emoji, created_at = now()
  `;
  return true;
}

export async function getTyping(): Promise<TypingState> {
  const sql = getSql();
  // Typing is only "live" for 5 seconds after the last keystroke ping.
  const rows = await sql`
    SELECT sender, updated_at FROM chat_typing
    WHERE updated_at > now() - interval '5 seconds'
    ORDER BY updated_at DESC LIMIT 1
  `;
  if (!rows.length) return null;
  return rows[0] as unknown as TypingState;
}

export async function setTyping(sender: Sender): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO chat_typing (sender, updated_at)
    VALUES (${sender}, now())
    ON CONFLICT (sender) DO UPDATE SET updated_at = now()
  `;
}

export async function markRead(forSender: Sender): Promise<void> {
  // Mark messages sent by the OTHER person as read for this phone.
  const other: Sender = forSender === "kaung" ? "love" : "kaung";
  const sql = getSql();
  await sql`
    UPDATE chat_messages
    SET read_at = now()
    WHERE sender = ${other} AND read_at IS NULL
  `;
}

// --- Push notification device tokens (FCM) ---

export async function registerPushToken(
  sender: Sender,
  token: string,
): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO push_tokens (sender, token)
    VALUES (${sender}, ${token})
    ON CONFLICT (token) DO UPDATE
      SET sender = EXCLUDED.sender, updated_at = now()
  `;
}

export async function getPushTokens(sender: Sender): Promise<string[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT token FROM push_tokens WHERE sender = ${sender}
  `;
  return (rows as unknown as { token: string }[]).map((r) => r.token);
}

export async function deletePushToken(token: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM push_tokens WHERE token = ${token}`;
}
