import { headers } from "next/headers";
import { and, eq, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { friendships, userPreferences } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const uid = session.user.id;

  // Include me + accepted friends
  const friendIds = await db
    .select({
      friendId: sql<string>`CASE WHEN ${friendships.requesterId} = ${uid} THEN ${friendships.addresseeId} ELSE ${friendships.requesterId} END`,
    })
    .from(friendships)
    .where(
      and(
        or(eq(friendships.requesterId, uid), eq(friendships.addresseeId, uid)),
        eq(friendships.status, "accepted"),
      ),
    );

  const ids = [uid, ...friendIds.map((r) => r.friendId)];

  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
      lat: userPreferences.currentLat,
      lng: userPreferences.currentLng,
      updatedAt: userPreferences.currentLocationUpdatedAt,
      bio: userPreferences.bio,
      neighborhood: userPreferences.neighborhood,
    })
    .from(user)
    .innerJoin(userPreferences, eq(userPreferences.userId, user.id))
    .where(
      and(
        isNotNull(userPreferences.currentLat),
        isNotNull(userPreferences.currentLng),
        sql`${user.id} = ANY(${ids})`,
      ),
    );

  return Response.json({
    me: session.user.id,
    friends: rows,
  });
}
