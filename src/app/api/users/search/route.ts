import { NextResponse } from "next/server";
import { searchUsers } from "@/lib/db";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Find people to add as friends, by name or email. Returns each
// person's friendship status relative to you (none / pending /
// accepted / blocked, and who sent the pending request).
export async function GET(req: Request) {
  try {
    const session = await requireSession();
    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
    if (q.length < 2) {
      return NextResponse.json({ users: [] });
    }
    const users = await searchUsers(session.user.id, q.slice(0, 100));
    return NextResponse.json({ users });
  } catch (e) {
    console.error("GET /api/users/search failed", e);
    return NextResponse.json(
      { error: "Could not search users" },
      { status: 500 },
    );
  }
}
