import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { lat, lng } = await request.json() as { lat?: number; lng?: number };
  if (typeof lat !== "number" || typeof lng !== "number") {
    return Response.json({ error: "lat and lng required" }, { status: 400 });
  }

  await db
    .update(userPreferences)
    .set({ currentLat: lat, currentLng: lng, currentLocationUpdatedAt: new Date(), updatedAt: new Date() })
    .where(eq(userPreferences.userId, session.user.id));

  return Response.json({ ok: true });
}
