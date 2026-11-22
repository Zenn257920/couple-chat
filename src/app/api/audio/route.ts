import { NextResponse } from "next/server";
import { getAudio } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Lazy-load one voice message's audio. The message list never includes
// audio_base64 (it would make the 1.5s poll huge); the app fetches the
// audio only when the user taps play, then caches the blob URL.
export async function GET(req: Request) {
  try {
    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const audio = await getAudio(id);
    if (!audio) {
      return NextResponse.json({ error: "Audio not found" }, { status: 404 });
    }
    return NextResponse.json(audio);
  } catch (e) {
    console.error("GET /api/audio failed", e);
    return NextResponse.json({ error: "Could not load audio" }, { status: 500 });
  }
}
