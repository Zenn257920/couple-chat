import { NextResponse } from "next/server";
import { getMessages, getTyping, insertMessage } from "@/lib/db";
import { displayName, otherSender, type Sender } from "@/lib/names";
import { sendPushTo } from "@/lib/push";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const [messages, typing] = await Promise.all([getMessages(), getTyping()]);
    return NextResponse.json({ messages, typing });
  } catch (e) {
    console.error("GET /api/messages failed", e);
    return NextResponse.json(
      { error: "Could not load messages" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const data = (await req.json()) as {
      sender?: unknown;
      body?: unknown;
      replyToId?: unknown;
      kind?: unknown;
      audioBase64?: unknown;
      audioDuration?: unknown;
      audioMime?: unknown;
    };
    if (data.sender !== "kaung" && data.sender !== "love") {
      return NextResponse.json({ error: "Invalid sender" }, { status: 400 });
    }
    const sender = data.sender as Sender;
    // Voice messages carry audio instead of text. The stored body is
    // just the label (used for the push preview); the audio itself is
    // fetched lazily via /api/audio and never rides the message list.
    // ~1 min of Opus is ~200 KB base64; cap at 2,000,000 chars
    // (~6 min) so one upload can never blow up the database.
    let body: string;
    let voice: { audioBase64: string; audioDuration: number; audioMime: string } | null = null;
    if (data.kind === "voice") {
      if (
        typeof data.audioBase64 !== "string" ||
        data.audioBase64.length < 100 ||
        data.audioBase64.length > 2_000_000 ||
        typeof data.audioDuration !== "number" ||
        !Number.isFinite(data.audioDuration) ||
        data.audioDuration < 1 ||
        data.audioDuration > 180 ||
        typeof data.audioMime !== "string" ||
        !data.audioMime.startsWith("audio/")
      ) {
        return NextResponse.json({ error: "Invalid voice data" }, { status: 400 });
      }
      body = "🎤 Voice message";
      voice = {
        audioBase64: data.audioBase64,
        audioDuration: Math.round(data.audioDuration),
        audioMime: data.audioMime,
      };
    } else {
      if (typeof data.body !== "string") {
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
      }
      body = data.body.trim();
      if (!body) {
        return NextResponse.json({ error: "Message is empty" }, { status: 400 });
      }
      if (body.length > 2000) {
        return NextResponse.json(
          { error: "Message is too long (max 2000 characters)" },
          { status: 400 },
        );
      }
    }
    const message = await insertMessage(
      sender,
      body,
      typeof data.replyToId === "number" ? data.replyToId : null,
      voice,
    );
    // Notify the other phone with a system notification (FCM). Fire and
    // forget: push must never delay or break the message response.
    const other = otherSender(sender);
    void sendPushTo(other, displayName(sender), body.slice(0, 120), sender);
    return NextResponse.json({ message }, { status: 201 });
  } catch (e) {
    console.error("POST /api/messages failed", e);
    return NextResponse.json(
      { error: "Could not send message" },
      { status: 500 },
    );
  }
}
