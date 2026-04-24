import { headers } from "next/headers";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { friendships, userPreferences } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const uid = session.user.id;
  const rows = await db
    .select({
      friendshipId: friendships.id,
      status: friendships.status,
      requesterId: friendships.requesterId,
      addresseeId: friendships.addresseeId,
      friendId: user.id,
      friendName: user.name,
      friendEmail: user.email,
      friendIntents: userPreferences.intents,
      friendSocialMode: userPreferences.socialMode,
      friendAvailability: userPreferences.availability,
      friendBio: userPreferences.bio,
    })
    .from(friendships)
    .innerJoin(
      user,
      or(
        and(eq(friendships.requesterId, uid), eq(user.id, friendships.addresseeId)),
        and(eq(friendships.addresseeId, uid), eq(user.id, friendships.requesterId)),
      ),
    )
    .leftJoin(userPreferences, eq(user.id, userPreferences.userId))
    .where(
      and(
        or(eq(friendships.requesterId, uid), eq(friendships.addresseeId, uid)),
        eq(friendships.status, "accepted"),
      ),
    );

  return Response.json(rows);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { addresseeEmail } = await request.json() as { addresseeEmail: string };
  if (!addresseeEmail) return Response.json({ error: "addresseeEmail required" }, { status: 400 });

  const [addressee] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, addresseeEmail.toLowerCase().trim()))
    .limit(1);

  if (!addressee) return Response.json({ error: "User not found" }, { status: 404 });
  if (addressee.id === session.user.id) return Response.json({ error: "Cannot add yourself" }, { status: 400 });

  try {
    await db.insert(friendships).values({
      requesterId: session.user.id,
      addresseeId: addressee.id,
      status: "pending",
    });
  } catch {
    return Response.json({ error: "Request already exists" }, { status: 409 });
  }

  return Response.json({ ok: true });
}
