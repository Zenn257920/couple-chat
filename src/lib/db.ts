import { neon } from "@neondatabase/serverless";
import type { Sender } from "./names";

export type ChatMessage = {
  id: number;
  sender: Sender;
  body: string;
  kind: string;
  created_at: string;
  read_at: string | null;
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
  const rows = await sql`
    SELECT id, sender, body, kind, created_at, read_at
    FROM chat_messages
    ORDER BY created_at ASC, id ASC
    LIMIT ${limit}
  `;
  return rows as unknown as ChatMessage[];
}

export async function insertMessage(
  sender: Sender,
  body: string,
): Promise<ChatMessage> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO chat_messages (sender, body, kind)
    VALUES (${sender}, ${body}, 'text')
    RETURNING id, sender, body, kind, created_at, read_at
  `;
  return rows[0] as unknown as ChatMessage;
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
