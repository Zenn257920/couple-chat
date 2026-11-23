import { NextResponse } from "next/server";
import {
  getProfilePhotos,
  getRoomsForUser,
  listFriends,
  setProfilePhoto,
} from "@/lib/db";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Profile photos: one per user, base64 JPEG compressed client-side
// to max 256px (~20–50 KB). A photo is only shared with people the
// user is friends with or shares a room with — never with strangers.
export async function GET(req: Request) {
  try {
    const session = await requireSession();
    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const ids = new URL(req.url)
      .searchParams.get("ids")
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);
    if (!ids?.length) {
      return NextResponse.json({ error: "ids required" }, { status: 400 });
    }
    const myId = session.user.id;
    const [friends, rooms] = await Promise.all([
      listFriends(myId),
      getRoomsForUser(myId),
    ]);
    const allowed = new Set<string>([myId]);
    for (const f of friends) allowed.add(f.id);
    for (const r of rooms) for (const m of r.memberIds) allowed.add(m);
    const photos = await getProfilePhotos(ids.filter((id) => allowed.has(id)));
    const out: Record<string, string | null> = {};
    for (const id of ids) out[id] = photos[id] ?? null;
    return NextResponse.json({ photos: out });
  } catch (e) {
    console.error("GET /api/profile-photo failed", e);
    return NextResponse.json(
      { error: "Could not load profile photos" },
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
    const data = (await req.json()) as {
      photoBase64?: unknown;
    };
    // null removes the photo. Otherwise a base64 JPEG, capped at
    // 500,000 chars so one upload can never blow up the database.
    if (data.photoBase64 !== null) {
      if (
        typeof data.photoBase64 !== "string" ||
        data.photoBase64.length < 100 ||
        data.photoBase64.length > 500_000
      ) {
        return NextResponse.json({ error: "Invalid photo" }, { status: 400 });
      }
    }
    await setProfilePhoto(
      session.user.id,
      (data.photoBase64 as string | null) ?? null,
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/profile-photo failed", e);
    return NextResponse.json(
      { error: "Could not save profile photo" },
      { status: 500 },
    );
  }
}
