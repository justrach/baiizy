import { headers } from "next/headers";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { favoritePlaces } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(favoritePlaces)
    .where(eq(favoritePlaces.userId, session.user.id))
    .orderBy(desc(favoritePlaces.createdAt));
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
  };
  if (!body.poi_id || !body.name) return Response.json({ error: "poi_id and name required" }, { status: 400 });

  try {
    await db.insert(favoritePlaces).values({
      userId: session.user.id,
      poiId: body.poi_id,
      name: body.name,
      category: body.category ?? null,
      address: body.address ?? null,
      lat: typeof body.lat === "number" ? body.lat : null,
      lng: typeof body.lng === "number" ? body.lng : null,
    });
  } catch {
    // Already favorited — ignore
  }

  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { poi_id } = await request.json() as { poi_id: string };
  await db
    .delete(favoritePlaces)
    .where(and(eq(favoritePlaces.userId, session.user.id), eq(favoritePlaces.poiId, poi_id)));
  return Response.json({ ok: true });
}
