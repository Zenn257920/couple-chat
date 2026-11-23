import { NextResponse } from "next/server";
import { markRead } from "@/lib/db";
import { isRoomMember } from "@/lib/db";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Mark the other members' messages in one room as read.
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const data = (await req.json()) as { roomId?: unknown };
    if (
      typeof data.roomId !== "number" ||
      !Number.isInteger(data.roomId) ||
      data.roomId <= 0
    ) {
      return NextResponse.json({ error: "Invalid roomId" }, { status: 400 });
    }
    if (!(await isRoomMember(data.roomId, session.user.id))) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }
    await markRead(data.roomId, session.user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/messages/read failed", e);
    return NextResponse.json(
      { error: "Could not mark messages as read" },
      { status: 500 },
    );
  }
}
