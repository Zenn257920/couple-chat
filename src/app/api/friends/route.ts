import { NextResponse } from "next/server";
import { listFriendRequests, listFriends } from "@/lib/db";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// My friends, plus incoming and outgoing friend requests.
export async function GET() {
  try {
    const session = await requireSession();
    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const [friends, requests] = await Promise.all([
      listFriends(session.user.id),
      listFriendRequests(session.user.id),
    ]);
    return NextResponse.json({
      friends,
      incoming: requests.incoming,
      outgoing: requests.outgoing,
    });
  } catch (e) {
    console.error("GET /api/friends failed", e);
    return NextResponse.json(
      { error: "Could not load friends" },
      { status: 500 },
    );
  }
}
