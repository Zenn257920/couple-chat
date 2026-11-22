import { NextResponse } from "next/server";
import { setPresence } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Heartbeat: the app posts this every 10s while open so the other
// phone can show Online / Last seen. Fire-and-forget, tiny write.
export async function POST(req: Request) {
  try {
    const data = (await req.json()) as { sender?: unknown };
    if (data.sender !== "kaung" && data.sender !== "love") {
      return NextResponse.json({ error: "Invalid sender" }, { status: 400 });
    }
    await setPresence(data.sender);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/presence failed", e);
    return NextResponse.json(
      { error: "Could not update presence" },
      { status: 500 },
    );
  }
}
