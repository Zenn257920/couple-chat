import { NextResponse } from "next/server";
import { setTyping } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const data = (await req.json()) as { sender?: unknown };
    if (data.sender !== "kaung" && data.sender !== "love") {
      return NextResponse.json({ error: "Invalid sender" }, { status: 400 });
    }
    await setTyping(data.sender);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/typing failed", e);
    return NextResponse.json(
      { error: "Could not update typing state" },
      { status: 500 },
    );
  }
}
