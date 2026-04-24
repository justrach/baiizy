import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { eventInvitees } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { status } = await request.json() as { status: "going" | "maybe" | "declined" };
  if (!["going", "maybe", "declined"].includes(status)) {
    return Response.json({ error: "Invalid status" }, { status: 400 });
  }

  const eventId = Number(id);

  // Upsert: if already invited, update; else insert as self-join (e.g. user wants to RSVP on own event)
  const existing = await db
    .select()
    .from(eventInvitees)
    .where(and(eq(eventInvitees.eventId, eventId), eq(eventInvitees.userId, session.user.id)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(eventInvitees)
      .set({ status, respondedAt: new Date() })
      .where(and(eq(eventInvitees.eventId, eventId), eq(eventInvitees.userId, session.user.id)));
  } else {
    await db.insert(eventInvitees).values({
      eventId,
      userId: session.user.id,
      status,
      respondedAt: new Date(),
    });
  }

  return Response.json({ ok: true });
}
