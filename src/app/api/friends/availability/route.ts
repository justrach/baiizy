import { headers } from "next/headers";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { friendships, userPreferences } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { auth } from "@/lib/auth";

const SLOT_LABELS: Record<string, string> = {
  "weekday-morning": "Weekday mornings",
  "weekday-lunch": "Weekday lunch",
  "weekday-evening": "Weekday evenings",
  "weekend-morning": "Weekend mornings",
  "weekend-afternoon": "Weekend afternoons",
  "late-night": "Late nights",
};

const SLOT_INTENT: Record<string, string> = {
  "weekday-morning": "work",
  "weekday-lunch": "lunch",
  "weekday-evening": "supper",
  "weekend-morning": "friend",
  "weekend-afternoon": "friend",
  "late-night": "supper",
};

type Person = {
  userId: string;
  name: string;
  username: string | null;
  image: string | null;
  availability: string[];
};

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const uid = session.user.id;

  const friendIdsRows = await db
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

  const friendIds = friendIdsRows.map((r) => r.friendId);
  const ids = [uid, ...friendIds];

  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
      availability: userPreferences.availability,
    })
    .from(user)
    .innerJoin(userPreferences, eq(userPreferences.userId, user.id))
    .where(inArray(user.id, ids));

  const me = rows.find((r) => r.userId === uid);
  const friends = rows.filter((r) => r.userId !== uid);

  const slots = Object.keys(SLOT_LABELS);
  const overlap = slots.map((slot) => {
    const meFree = !!me?.availability?.includes(slot);
    const freeFriends: Person[] = friends.filter((f) => f.availability?.includes(slot));
    return {
      slot,
      label: SLOT_LABELS[slot],
      suggestedIntent: SLOT_INTENT[slot],
      meFree,
      friends: freeFriends,
      count: freeFriends.length + (meFree ? 1 : 0),
    };
  });

  overlap.sort((a, b) => {
    const aScore = (a.meFree ? 100 : 0) + a.friends.length;
    const bScore = (b.meFree ? 100 : 0) + b.friends.length;
    return bScore - aScore;
  });

  return Response.json({ overlap, totalFriends: friends.length });
}
