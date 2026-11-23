import { NextResponse } from "next/server";
import {
  getMessageRoom,
  isRoomMember,
  toggleReaction,
} from "@/lib/db";
import { isReactionEmoji } from "@/lib/reactions";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Toggle a message reaction. Same emoji again removes it, another one
// replaces it (one reaction per person per message, like Telegram).
// No push notification for reactions — the other phones see them on
// the next poll (1.5s) while the app is open.
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const data = (await req.json()) as {
      messageId?: unknown;
      emoji?: unknown;
    };
    if (typeof data.messageId !== "number" || !Number.isInteger(data.messageId) || data.messageId <= 0) {
      return NextResponse.json({ error: "Invalid messageId" }, { status: 400 });
    }
    if (!isReactionEmoji(data.emoji)) {
      return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
    }
    // Only a member of the message's room may react to it.
    const roomId = await getMessageRoom(data.messageId);
    if (!roomId || !(await isRoomMember(roomId, session.user.id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const reacted = await toggleReaction(data.messageId, session.user.id, data.emoji);
    return NextResponse.json({ reacted });
  } catch (e) {
    console.error("POST /api/reactions failed", e);
    return NextResponse.json({ error: "Could not save reaction" }, { status: 500 });
  }
}
