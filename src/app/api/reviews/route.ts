import { headers } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { reviews } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { auth } from "@/lib/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const poiId = searchParams.get("poi_id");
  if (!poiId) return Response.json({ error: "poi_id required" }, { status: 400 });

  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
      userId: user.id,
      userName: user.name,
      userUsername: user.username,
      userImage: user.image,
    })
    .from(reviews)
    .innerJoin(user, eq(user.id, reviews.userId))
    .where(eq(reviews.poiId, poiId))
    .orderBy(desc(reviews.createdAt));

  const avg = rows.length > 0 ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : null;

  return Response.json({ reviews: rows, averageRating: avg, count: rows.length });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    poi_id: string;
    venue_name: string;
    venue_category?: string;
    rating: number;
    comment?: string;
  };

  if (!body.poi_id || !body.venue_name) return Response.json({ error: "poi_id and venue_name required" }, { status: 400 });
  const rating = Math.max(1, Math.min(5, Math.round(body.rating)));

  await db
    .insert(reviews)
    .values({
      userId: session.user.id,
      poiId: body.poi_id,
      venueName: body.venue_name,
      venueCategory: body.venue_category ?? null,
      rating,
      comment: body.comment ?? null,
    })
    .onConflictDoUpdate({
      target: [reviews.userId, reviews.poiId],
      set: { rating, comment: body.comment ?? null, venueName: body.venue_name, venueCategory: body.venue_category ?? null },
    });

  return Response.json({ ok: true });
}
