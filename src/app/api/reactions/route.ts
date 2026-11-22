import { NextResponse } from "next/server";
import { toggleReaction } from "@/lib/db";
import { isReactionEmoji } from "@/lib/reactions";
import type { Sender } from "@/lib/names";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Toggle a message reaction. Same emoji again removes it, another one
// replaces it (one reaction per person per message, like Telegram).
// No push notification for reactions — the other phone sees them on
// the next poll (1.5s) while the app is open.
export async function POST(req: Request) {
  try {
    const data = (await req.json()) as {
      sender?: unknown;
      messageId?: unknown;
      emoji?: unknown;
    };
    if (data.sender !== "kaung" && data.sender !== "love") {
      return NextResponse.json({ error: "Invalid sender" }, { status: 400 });
    }
    const sender = data.sender as Sender;
    if (typeof data.messageId !== "number" || !Number.isInteger(data.messageId) || data.messageId <= 0) {
      return NextResponse.json({ error: "Invalid messageId" }, { status: 400 });
    }
    if (!isReactionEmoji(data.emoji)) {
      return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
    }
    const reacted = await toggleReaction(data.messageId, sender, data.emoji);
    return NextResponse.json({ reacted });
  } catch (e) {
    console.error("POST /api/reactions failed", e);
    return NextResponse.json({ error: "Could not save reaction" }, { status: 500 });
  }
}
