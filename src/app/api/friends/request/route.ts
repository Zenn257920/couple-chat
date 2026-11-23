import { NextResponse } from "next/server";
import { getUserByEmail, sendFriendRequest } from "@/lib/db";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Send a friend request — by user id (from search results) or by
// email. If they already requested you, the two requests collapse
// into an accepted friendship.
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const data = (await req.json()) as {
      userId?: unknown;
      email?: unknown;
    };
    let addresseeId: string | null = null;
    if (typeof data.userId === "string" && data.userId.trim()) {
      addresseeId = data.userId.trim();
    } else if (typeof data.email === "string" && data.email.trim()) {
      const user = await getUserByEmail(data.email.trim());
      if (!user) {
        return NextResponse.json(
          { error: "No account with that email" },
          { status: 404 },
        );
      }
      addresseeId = user.id;
    } else {
      return NextResponse.json(
        { error: "userId or email required" },
        { status: 400 },
      );
    }
    try {
      const result = await sendFriendRequest(session.user.id, addresseeId);
      if (result === "already") {
        return NextResponse.json({ status: "already" });
      }
      return NextResponse.json({ status: result });
    } catch (e) {
      if (e instanceof Error) {
        if (e.message === "cannot add yourself") {
          return NextResponse.json(
            { error: "You can't add yourself" },
            { status: 400 },
          );
        }
        if (e.message === "blocked") {
          return NextResponse.json(
            { error: "Can't send that request" },
            { status: 403 },
          );
        }
      }
      throw e;
    }
  } catch (e) {
    console.error("POST /api/friends/request failed", e);
    return NextResponse.json(
      { error: "Could not send friend request" },
      { status: 500 },
    );
  }
}
