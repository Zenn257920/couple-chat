import { NextResponse } from "next/server";
import { createGroup } from "@/lib/db";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Create a group chat. Every member must already be an accepted
// friend of the creator — strangers can't be pulled into a group.
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const data = (await req.json()) as {
      name?: unknown;
      memberIds?: unknown;
    };
    if (typeof data.name !== "string") {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }
    if (
      !Array.isArray(data.memberIds) ||
      data.memberIds.some((id) => typeof id !== "string")
    ) {
      return NextResponse.json({ error: "Invalid memberIds" }, { status: 400 });
    }
    try {
      const room = await createGroup(
        session.user.id,
        data.name,
        data.memberIds as string[],
      );
      return NextResponse.json({ room }, { status: 201 });
    } catch (e) {
      if (e instanceof Error) {
        if (e.message === "not all members are friends") {
          return NextResponse.json(
            { error: "Everyone in a group must be your friend" },
            { status: 403 },
          );
        }
        if (e.message === "no members" || e.message === "invalid name") {
          return NextResponse.json({ error: e.message }, { status: 400 });
        }
      }
      throw e;
    }
  } catch (e) {
    console.error("POST /api/rooms/group failed", e);
    return NextResponse.json(
      { error: "Could not create group" },
      { status: 500 },
    );
  }
}
