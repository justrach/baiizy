import { headers } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { checkins } from "@/db/schema";
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

  return Response.json({ ok: true, checkin: row });
}
