import { headers } from "next/headers";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { events, eventInvitees, userPreferences, friendships } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { auth } from "@/lib/auth";

type GrabPlace = {
  poi_id: string;
  name: string;
  formatted_address?: string;
  location: { latitude: number; longitude: number };
  category?: string;
  business_type?: string;
};

async function findVenueNear(lat: number, lng: number): Promise<Partial<GrabPlace> | null> {
  const apiKey = process.env.GRAB_MAPS_API_KEY;
  if (!apiKey) return null;
  const q = new URLSearchParams({ keyword: "cafe", country: "SGP", location: `${lat},${lng}`, limit: "4" });
  try {
    const res = await fetch(`https://maps.grab.com/api/v1/maps/poi/v1/search?${q}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { places?: GrabPlace[] };
    return data.places?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { friendUserId?: string; startsInMin?: number };
  if (!body.friendUserId) return Response.json({ error: "friendUserId required" }, { status: 400 });

  const uid = session.user.id;
  const friendId = body.friendUserId;

  // Confirm they are actually accepted friends
  const [link] = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(
      and(
        or(
          and(eq(friendships.requesterId, uid), eq(friendships.addresseeId, friendId)),
          and(eq(friendships.requesterId, friendId), eq(friendships.addresseeId, uid)),
        ),
        eq(friendships.status, "accepted"),
      ),
    )
    .limit(1);
  if (!link) return Response.json({ error: "Not your friend" }, { status: 403 });

  // Load both locations + friend's name
  const [me] = await db.select({ lat: userPreferences.currentLat, lng: userPreferences.currentLng }).from(userPreferences).where(eq(userPreferences.userId, uid)).limit(1);
  const [them] = await db
    .select({
      lat: userPreferences.currentLat,
      lng: userPreferences.currentLng,
      name: user.name,
    })
    .from(userPreferences)
    .innerJoin(user, eq(user.id, userPreferences.userId))
    .where(eq(userPreferences.userId, friendId))
    .limit(1);

  if (!me?.lat || !me?.lng || !them?.lat || !them?.lng) {
    return Response.json({ error: "Missing live locations" }, { status: 400 });
  }

  // Midpoint — find a spot halfway between the two
  const midLat = (me.lat + them.lat) / 2;
  const midLng = (me.lng + them.lng) / 2;
  const venue = await findVenueNear(midLat, midLng);

  const startsAt = new Date(Date.now() + (body.startsInMin ?? 15) * 60_000);

  const [ev] = await db
    .insert(events)
    .values({
      creatorId: uid,
      title: `Quick hang with ${them.name.split(" ")[0]}`,
      description: `Spontaneous meetup at the halfway point between you and ${them.name}. Starts in ${body.startsInMin ?? 15} min.`,
      venuePoiId: venue?.poi_id ?? "midpoint-adhoc",
      venueName: venue?.name ?? "Halfway point",
      venueAddress: venue?.formatted_address ?? null,
      venueCategory: venue?.category ?? venue?.business_type ?? null,
      venueLat: venue?.location?.latitude ?? midLat,
      venueLng: venue?.location?.longitude ?? midLng,
      startsAt,
    })
    .returning();

  // Invite the friend
  await db.insert(eventInvitees).values({ eventId: ev.id, userId: friendId });
  // Mark creator as going
  await db
    .insert(eventInvitees)
    .values({ eventId: ev.id, userId: uid, status: "going", respondedAt: new Date() })
    .onConflictDoNothing();

  return Response.json({ ok: true, event: ev });
}
