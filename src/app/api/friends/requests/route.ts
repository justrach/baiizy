import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { friendships } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: friendships.id,
      createdAt: friendships.createdAt,
      requesterId: user.id,
      requesterName: user.name,
      requesterEmail: user.email,
      requesterUsername: user.username,
      requesterImage: user.image,
    })
    .from(friendships)
    .innerJoin(user, eq(friendships.requesterId, user.id))
    .where(
      and(
        eq(friendships.addresseeId, session.user.id),
        eq(friendships.status, "pending"),
      ),
    );

  return Response.json(rows);
}
