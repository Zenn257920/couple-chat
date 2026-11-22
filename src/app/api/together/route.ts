import { NextResponse } from "next/server";
import { deleteMeta, getMeta, setMeta } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TOGETHER_KEY = "together_since";

// The date the couple has been together (YYYY-MM-DD), shared by both
// phones. The header shows a live counter from this date; either
// phone can set or change it in Settings.
export async function GET() {
  try {
    const date = await getMeta(TOGETHER_KEY);
    return NextResponse.json({ date });
  } catch (e) {
    console.error("GET /api/together failed", e);
    return NextResponse.json(
      { error: "Could not load together date" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const data = (await req.json()) as { date?: unknown };
    // null clears the date (the counter bar hides again).
    if (data.date === null) {
      await deleteMeta(TOGETHER_KEY);
      return NextResponse.json({ ok: true, date: null });
    }
    if (
      typeof data.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.date) ||
      Number.isNaN(new Date(`${data.date}T00:00:00`).getTime())
    ) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    await setMeta(TOGETHER_KEY, data.date);
    return NextResponse.json({ ok: true, date: data.date });
  } catch (e) {
    console.error("POST /api/together failed", e);
    return NextResponse.json(
      { error: "Could not save together date" },
      { status: 500 },
    );
  }
}
