import { headers } from "next/headers";
import { and, desc, eq, gte, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { events, eventInvitees } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const uid = session.user.id;

  // Events I'm invited to
  const invitedEventIds = await db
    .select({ id: eventInvitees.eventId })
    .from(eventInvitees)
    .where(eq(eventInvitees.userId, uid));

  const ids = invitedEventIds.map((r) => r.id);

  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      venueName: events.venueName,
      venueAddress: events.venueAddress,
      venueCategory: events.venueCategory,
      venuePoiId: events.venuePoiId,
      venueLat: events.venueLat,
      venueLng: events.venueLng,
      startsAt: events.startsAt,
      coverImage: events.coverImage,
      creatorId: events.creatorId,
      creatorName: user.name,
      creatorImage: user.image,
    })
    .from(events)
    .innerJoin(user, eq(user.id, events.creatorId))
    .where(
      and(
        gte(events.startsAt, new Date()),
        ids.length > 0
          ? or(eq(events.creatorId, uid), inArray(events.id, ids))
          : eq(events.creatorId, uid),
      ),
    )
    .orderBy(events.startsAt);

  return Response.json(rows);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    title: string;
    description?: string;
    venuePoiId: string;
    venueName: string;
    venueAddress?: string;
    venueCategory?: string;
    venueLat?: number;
    venueLng?: number;
    startsAt: string; // ISO
    inviteUserIds?: string[];
  };

  if (!body.title || !body.venuePoiId || !body.venueName || !body.startsAt) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const [event] = await db.insert(events).values({
    creatorId: session.user.id,
    title: body.title,
    description: body.description ?? null,
    venuePoiId: body.venuePoiId,
    venueName: body.venueName,
    venueAddress: body.venueAddress ?? null,
    venueCategory: body.venueCategory ?? null,
    venueLat: typeof body.venueLat === "number" ? body.venueLat : null,
    venueLng: typeof body.venueLng === "number" ? body.venueLng : null,
    startsAt: new Date(body.startsAt),
  }).returning();

  // Invite friends
  if (body.inviteUserIds && body.inviteUserIds.length > 0) {
    const invites = body.inviteUserIds.map((userId) => ({
      eventId: event.id,
      userId,
    }));
    await db.insert(eventInvitees).values(invites).onConflictDoNothing();
  }

  return Response.json({ ok: true, event });
}
