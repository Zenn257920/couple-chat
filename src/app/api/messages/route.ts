import { NextResponse } from "next/server";
import {
  getMessages,
  getPresence,
  getRoomMemberIds,
  getRoomUsers,
  getTyping,
  insertMessage,
  isRoomMember,
  updateMessage,
} from "@/lib/db";
import { requireSession } from "@/lib/session";
import { sendPushToRoom } from "@/lib/push";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function roomIdParam(req: Request): number | null {
  const id = Number(new URL(req.url).searchParams.get("roomId"));
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Load one room's messages (newest 200), typing state, presence of
// its members, and the members' display info. Session + membership
// required — a room is only visible to its members.
export async function GET(req: Request) {
  try {
    const session = await requireSession();
    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const roomId = roomIdParam(req);
    if (!roomId) {
      return NextResponse.json({ error: "Invalid roomId" }, { status: 400 });
    }
    if (!(await isRoomMember(roomId, session.user.id))) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }
    const memberIds = await getRoomMemberIds(roomId);
    const [messages, typing, presence, users] = await Promise.all([
      getMessages(roomId),
      getTyping(roomId),
      getPresence(memberIds),
      getRoomUsers(memberIds),
    ]);
    return NextResponse.json({ messages, typing, presence, users });
  } catch (e) {
    console.error("GET /api/messages failed", e);
    return NextResponse.json(
      { error: "Could not load messages" },
      { status: 500 },
    );
  }
}

// Edit your own text message (no delete). No push for edits.
export async function PATCH(req: Request) {
  try {
    const session = await requireSession();
    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const data = (await req.json()) as {
      id?: unknown;
      body?: unknown;
    };
    if (typeof data.id !== "number" || !Number.isInteger(data.id) || data.id <= 0) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    if (typeof data.body !== "string") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const body = data.body.trim();
    if (!body) {
      return NextResponse.json({ error: "Message is empty" }, { status: 400 });
    }
    if (body.length > 2000) {
      return NextResponse.json(
        { error: "Message is too long (max 2000 characters)" },
        { status: 400 },
      );
    }
    const message = await updateMessage(data.id, session.user.id, body);
    if (!message) {
      return NextResponse.json(
        { error: "Message not found or not yours" },
        { status: 404 },
      );
    }
    return NextResponse.json({ message });
  } catch (e) {
    console.error("PATCH /api/messages failed", e);
    return NextResponse.json(
      { error: "Could not edit message" },
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
      roomId?: unknown;
      body?: unknown;
      replyToId?: unknown;
      kind?: unknown;
      audioBase64?: unknown;
      audioDuration?: unknown;
      audioMime?: unknown;
      photoBase64?: unknown;
      photoWidth?: unknown;
      photoHeight?: unknown;
    };
    const roomId = data.roomId;
    if (typeof roomId !== "number" || !Number.isInteger(roomId) || roomId <= 0) {
      return NextResponse.json({ error: "Invalid roomId" }, { status: 400 });
    }
    if (!(await isRoomMember(roomId, session.user.id))) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }
    const senderId = session.user.id;
    // Voice messages carry audio instead of text. The stored body is
    // just the label (used for the push preview); the audio itself is
    // fetched lazily via /api/audio and never rides the message list.
    // ~1 min of Opus is ~200 KB base64; cap at 2,000,000 chars
    // (~6 min) so one upload can never blow up the database.
    let body: string;
    let voice: { audioBase64: string; audioDuration: number; audioMime: string } | null = null;
    let photo: { photoBase64: string; photoWidth: number; photoHeight: number } | null = null;
    if (data.kind === "photo") {
      // Photos are compressed client-side to max 1200px JPEG
      // (~150–400 KB); cap at 2,000,000 base64 chars so one upload
      // can never blow up the database. The image itself is fetched
      // lazily via /api/photo and never rides the message list.
      if (
        typeof data.photoBase64 !== "string" ||
        data.photoBase64.length < 100 ||
        data.photoBase64.length > 2_000_000 ||
        typeof data.photoWidth !== "number" ||
        !Number.isInteger(data.photoWidth) ||
        data.photoWidth < 1 ||
        data.photoWidth > 4000 ||
        typeof data.photoHeight !== "number" ||
        !Number.isInteger(data.photoHeight) ||
        data.photoHeight < 1 ||
        data.photoHeight > 4000
      ) {
        return NextResponse.json({ error: "Invalid photo data" }, { status: 400 });
      }
      body = "📷 Photo";
      photo = {
        photoBase64: data.photoBase64,
        photoWidth: data.photoWidth,
        photoHeight: data.photoHeight,
      };
    } else if (data.kind === "voice") {
      if (
        typeof data.audioBase64 !== "string" ||
        data.audioBase64.length < 100 ||
        data.audioBase64.length > 2_000_000 ||
        typeof data.audioDuration !== "number" ||
        !Number.isFinite(data.audioDuration) ||
        data.audioDuration < 1 ||
        data.audioDuration > 180 ||
        typeof data.audioMime !== "string" ||
        !data.audioMime.startsWith("audio/")
      ) {
        return NextResponse.json({ error: "Invalid voice data" }, { status: 400 });
      }
      body = "🎤 Voice message";
      voice = {
        audioBase64: data.audioBase64,
        audioDuration: Math.round(data.audioDuration),
        audioMime: data.audioMime,
      };
    } else {
      if (typeof data.body !== "string") {
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
      }
      body = data.body.trim();
      if (!body) {
        return NextResponse.json({ error: "Message is empty" }, { status: 400 });
      }
      if (body.length > 2000) {
        return NextResponse.json(
          { error: "Message is too long (max 2000 characters)" },
          { status: 400 },
        );
      }
    }
    const message = await insertMessage(
      senderId,
      roomId,
      body,
      typeof data.replyToId === "number" ? data.replyToId : null,
      voice,
      photo,
    );
    // Notify the other members of the room with a system
    // notification (FCM). Fire and forget: push must never delay or
    // break the message response.
    void sendPushToRoom(
      roomId,
      session.user.name,
      body.slice(0, 120),
      senderId,
    );
    return NextResponse.json({ message }, { status: 201 });
  } catch (e) {
    console.error("POST /api/messages failed", e);
    return NextResponse.json(
      { error: "Could not send message" },
      { status: 500 },
    );
  }
}
