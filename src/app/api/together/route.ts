import { NextResponse } from "next/server";
import { getTogetherDate, isRoomMember, setTogetherDate } from "@/lib/db";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// The Together date lives on ONE room — the couple's DM
// (rooms.together_since, backfilled from chat_meta by the migration).
// Other rooms never have a counter. The date can only be changed
// when the room already has one set.
export async function GET(req: Request) {
  try {
    const session = await requireSession();
    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const roomId = Number(new URL(req.url).searchParams.get("roomId"));
    if (!Number.isInteger(roomId) || roomId <= 0) {
      return NextResponse.json({ error: "Invalid roomId" }, { status: 400 });
    }
    if (!(await isRoomMember(roomId, session.user.id))) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }
    const date = await getTogetherDate(roomId);
    return NextResponse.json({ date });
  } catch (e) {
    console.error("GET /api/together failed", e);
    return NextResponse.json(
      { error: "Could not load together date" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const data = (await req.json()) as { roomId?: unknown; date?: unknown };
    if (
      typeof data.roomId !== "number" ||
      !Number.isInteger(data.roomId) ||
      data.roomId <= 0
    ) {
      return NextResponse.json({ error: "Invalid roomId" }, { status: 400 });
    }
    // null clears the date (the counter hides again).
    if (data.date === null) {
      const ok = await setTogetherDate(data.roomId, session.user.id, null);
      if (!ok) {
        return NextResponse.json(
          { error: "This room has no Together date" },
          { status: 403 },
        );
      }
      return NextResponse.json({ ok: true, date: null });
    }
    if (
      typeof data.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.date) ||
      Number.isNaN(new Date(`${data.date}T00:00:00`).getTime())
    ) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    const ok = await setTogetherDate(data.roomId, session.user.id, data.date);
    if (!ok) {
      return NextResponse.json(
        { error: "This room has no Together date" },
        { status: 403 },
      );
    }
    return NextResponse.json({ ok: true, date: data.date });
  } catch (e) {
    console.error("POST /api/together failed", e);
    return NextResponse.json(
      { error: "Could not save together date" },
      { status: 500 },
    );
  }
}
