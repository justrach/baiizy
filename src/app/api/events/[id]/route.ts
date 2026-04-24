import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { events, eventInvitees } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { auth } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const eventId = Number(id);

  const [event] = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      venuePoiId: events.venuePoiId,
      venueName: events.venueName,
      venueAddress: events.venueAddress,
      venueCategory: events.venueCategory,
      venueLat: events.venueLat,
      venueLng: events.venueLng,
      startsAt: events.startsAt,
      coverImage: events.coverImage,
      creatorId: events.creatorId,
      creatorName: user.name,
      creatorImage: user.image,
      creatorUsername: user.username,
    })
    .from(events)
    .innerJoin(user, eq(user.id, events.creatorId))
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) return Response.json({ error: "Not found" }, { status: 404 });

  const invitees = await db
    .select({
      id: eventInvitees.id,
      status: eventInvitees.status,
      userId: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      image: user.image,
    })
    .from(eventInvitees)
    .innerJoin(user, eq(user.id, eventInvitees.userId))
    .where(eq(eventInvitees.eventId, eventId));

  const myInvite = invitees.find((i) => i.userId === session.user.id);
  const isCreator = event.creatorId === session.user.id;

  return Response.json({ event, invitees, myStatus: myInvite?.status ?? null, isCreator });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.delete(events).where(and(eq(events.id, Number(id)), eq(events.creatorId, session.user.id)));
  return Response.json({ ok: true });
}
