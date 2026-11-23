import { NextResponse } from "next/server";
import { registerPushToken } from "@/lib/db";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// The APK calls this after FCM gives it a device token, so the server
// can send that phone a system notification when a friend writes.
// Called again whenever the token refreshes (upsert by token). The
// token is registered under the signed-in user's id.
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const data = (await req.json()) as { token?: unknown };
    if (
      typeof data.token !== "string" ||
      !data.token.trim() ||
      data.token.length > 500
    ) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }
    await registerPushToken(session.user.id, data.token.trim());
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/push/register failed", e);
    return NextResponse.json(
      { error: "Could not register token" },
      { status: 500 },
    );
  }
}
