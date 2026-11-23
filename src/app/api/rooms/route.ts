import { NextResponse } from "next/server";
import { getRoomsForUser, getRoomUsers } from "@/lib/db";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// My chats: DMs + groups, newest activity first, each with its last
// message, unread count, and member ids. `users` carries the display
// info (name, avatar, profile photo) for every member of every room,
// so the client never needs a second round-trip per room.
export async function GET() {
  try {
    const session = await requireSession();
    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const rooms = await getRoomsForUser(session.user.id);
    const memberIds = [
      ...new Set(rooms.flatMap((r) => r.memberIds)),
    ];
    const users = await getRoomUsers(memberIds);
    return NextResponse.json({ rooms, users });
  } catch (e) {
    console.error("GET /api/rooms failed", e);
    return NextResponse.json(
      { error: "Could not load rooms" },
      { status: 500 },
    );
  }
}
