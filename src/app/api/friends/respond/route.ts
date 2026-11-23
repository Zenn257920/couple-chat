import { NextResponse } from "next/server";
import { respondFriendRequest } from "@/lib/db";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Accept or decline an incoming friend request. Only the person the
// request was sent to can respond.
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const data = (await req.json()) as {
      requesterId?: unknown;
      accept?: unknown;
    };
    if (typeof data.requesterId !== "string" || !data.requesterId.trim()) {
      return NextResponse.json(
        { error: "Invalid requesterId" },
        { status: 400 },
      );
    }
    if (typeof data.accept !== "boolean") {
      return NextResponse.json({ error: "Invalid accept" }, { status: 400 });
    }
    try {
      await respondFriendRequest(
        session.user.id,
        data.requesterId.trim(),
        data.accept,
      );
      return NextResponse.json({ ok: true });
    } catch (e) {
      if (e instanceof Error && e.message === "request not found") {
        return NextResponse.json(
          { error: "Request not found" },
          { status: 404 },
        );
      }
      throw e;
    }
  } catch (e) {
    console.error("POST /api/friends/respond failed", e);
    return NextResponse.json(
      { error: "Could not respond to request" },
      { status: 500 },
    );
  }
}
