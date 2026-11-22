import { NextResponse } from "next/server";
import { registerPushToken } from "@/lib/db";
import type { Sender } from "@/lib/names";

export const dynamic = "force-dynamic";

// The APK calls this after FCM gives it a device token, so the server
// can send that phone a system notification when the other person
// writes. Called again whenever the token refreshes (upsert by token).
export async function POST(req: Request) {
  try {
    const data = (await req.json()) as { sender?: unknown; token?: unknown };
    if (data.sender !== "kaung" && data.sender !== "love") {
      return NextResponse.json({ error: "Invalid sender" }, { status: 400 });
    }
    if (
      typeof data.token !== "string" ||
      !data.token.trim() ||
      data.token.length > 500
    ) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }
    await registerPushToken(data.sender as Sender, data.token.trim());
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/push/register failed", e);
    return NextResponse.json(
      { error: "Could not register token" },
      { status: 500 },
    );
  }
}
