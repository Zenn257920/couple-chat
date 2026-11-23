import { NextResponse } from "next/server";
import { getOrCreateDM } from "@/lib/db";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Get-or-create a 1:1 chat with a friend. Only accepted friends can
// open a DM — strangers can't message you. Returns the room (the
// existing one when the DM already exists).
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const data = (await req.json()) as { friendId?: unknown };
    if (typeof data.friendId !== "string" || !data.friendId.trim()) {
      return NextResponse.json({ error: "Invalid friendId" }, { status: 400 });
    }
    if (data.friendId === session.user.id) {
      return NextResponse.json(
        { error: "You can't chat with yourself" },
        { status: 400 },
      );
    }
    try {
      const room = await getOrCreateDM(session.user.id, data.friendId.trim());
      return NextResponse.json({ room }, { status: 201 });
    } catch (e) {
      if (e instanceof Error && e.message === "not friends") {
        return NextResponse.json(
          { error: "Add them as a friend first" },
          { status: 403 },
        );
      }
      throw e;
    }
  } catch (e) {
    console.error("POST /api/rooms/dm failed", e);
    return NextResponse.json(
      { error: "Could not open chat" },
      { status: 500 },
    );
  }
}
