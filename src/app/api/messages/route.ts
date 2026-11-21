import { NextResponse } from "next/server";
import { getMessages, getTyping, insertMessage } from "@/lib/db";
import type { Sender } from "@/lib/names";

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
    const data = (await req.json()) as { sender?: unknown; body?: unknown };
    if (data.sender !== "kaung" && data.sender !== "love") {
      return NextResponse.json({ error: "Invalid sender" }, { status: 400 });
    }
    const sender = data.sender as Sender;
    if (typeof data.body !== "string") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const body = data.body.trim();
    if (!body) {
      return NextResponse.json({ error: "Message is empty" }, { status: 400 });
    }
    if (body.length > 2000) {
      return NextResponse.json(
        { error: "Message is too long (max 2000 characters)" },
        { status: 400 },
      );
    }
    const message = await insertMessage(sender, body);
    return NextResponse.json({ message }, { status: 201 });
  } catch (e) {
    console.error("POST /api/messages failed", e);
    return NextResponse.json(
      { error: "Could not send message" },
      { status: 500 },
    );
  }
}
