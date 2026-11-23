import { NextResponse } from "next/server";
import { setPresence } from "@/lib/db";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Heartbeat: the app posts this every 10s while open so friends can
// see Online / Last seen. Fire-and-forget, tiny write.
export async function POST() {
  try {
    const session = await requireSession();
    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    await setPresence(session.user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/presence failed", e);
    return NextResponse.json(
      { error: "Could not update presence" },
      { status: 500 },
    );
  }
}
