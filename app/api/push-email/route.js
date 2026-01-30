import { NextResponse } from "next/server";
import { sendInstantEmail } from "@/lib/notification";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const eventId = body?.eventId;
    const notifType = String(body?.notifType || "H-1");
    const broadcastToAll = body?.broadcastToAll;

    const result = await sendInstantEmail({ eventId, notifType, broadcastToAll });

    if (!result.ok) {
      if (result.error === "Event not found") {
        return NextResponse.json(result, { status: 404 });
      }
      if (result.error === "Missing eventId") {
        return NextResponse.json(result, { status: 400 });
      }
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
