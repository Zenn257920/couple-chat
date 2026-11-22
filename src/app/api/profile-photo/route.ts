import { NextResponse } from "next/server";
import { getProfilePhotos, setProfilePhoto } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Profile photos: one per person, base64 JPEG compressed client-side
// to max 256px (~20–50 KB). Both phones fetch both photos once on
// load (never in the 1.5s poll); the header shows the other
// person's photo, Settings shows your own.
export async function GET() {
  try {
    const photos = await getProfilePhotos();
    return NextResponse.json({ photos });
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
    const data = (await req.json()) as {
      sender?: unknown;
      photoBase64?: unknown;
    };
    if (data.sender !== "kaung" && data.sender !== "love") {
      return NextResponse.json({ error: "Invalid sender" }, { status: 400 });
    }
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
      data.sender,
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
