import { NextResponse } from "next/server";
import { getPhoto } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Lazy photo fetch: the message list never carries photo_base64, so
// the 1.5s poll stays small. The client fetches a photo once when the
// user taps it and caches the data URL.
export async function GET(req: Request) {
  try {
    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const photo = await getPhoto(id);
    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }
    return NextResponse.json({ photoBase64: photo.photoBase64 });
  } catch (e) {
    console.error("GET /api/photo failed", e);
    return NextResponse.json(
      { error: "Could not load photo" },
      { status: 500 },
    );
  }
}
