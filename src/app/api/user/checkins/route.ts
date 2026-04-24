import { headers } from "next/headers";
import { and, desc, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { checkins, friendships, notifications } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(checkins)
    .where(eq(checkins.userId, session.user.id))
    .orderBy(desc(checkins.createdAt))
    .limit(50);
  return Response.json(rows);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    poi_id: string;
    name: string;
    category?: string;
    address?: string;
    lat?: number;
    lng?: number;
    note?: string;
    rating?: number;
  };
  if (!body.poi_id || !body.name) return Response.json({ error: "poi_id and name required" }, { status: 400 });

  const rating = typeof body.rating === "number" ? Math.max(1, Math.min(5, Math.round(body.rating))) : null;

  const [row] = await db.insert(checkins).values({
    userId: session.user.id,
    poiId: body.poi_id,
    name: body.name,
    category: body.category ?? null,
    address: body.address ?? null,
    lat: typeof body.lat === "number" ? body.lat : null,
    lng: typeof body.lng === "number" ? body.lng : null,
    note: body.note ?? null,
    rating,
  }).returning();

  // Fan out a notification to every accepted friend
  const uid = session.user.id;
  const friendIds = await db
    .select({ requesterId: friendships.requesterId, addresseeId: friendships.addresseeId })
    .from(friendships)
    .where(
      and(
        or(eq(friendships.requesterId, uid), eq(friendships.addresseeId, uid)),
        eq(friendships.status, "accepted"),
      ),
    );
  const recipients = friendIds
    .map((f) => (f.requesterId === uid ? f.addresseeId : f.requesterId))
    .filter((id): id is string => !!id && id !== uid);

  if (recipients.length > 0) {
    await db.insert(notifications).values(
      recipients.map((rid) => ({
        userId: rid,
        actorId: uid,
        kind: "checkin",
        payload: {
          name: body.name,
          category: body.category ?? null,
          address: body.address ?? null,
          lat: typeof body.lat === "number" ? body.lat : null,
          lng: typeof body.lng === "number" ? body.lng : null,
          poiId: body.poi_id,
          note: body.note ?? null,
        },
      })),
    );
  }

  return Response.json({ ok: true, checkin: row, notified: recipients.length });
}
