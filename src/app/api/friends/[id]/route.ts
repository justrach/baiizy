import { headers } from "next/headers";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { friendships } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { status } = await request.json() as { status: "accepted" | "declined" };

  await db
    .update(friendships)
    .set({ status })
    .where(
      and(
        eq(friendships.id, Number(id)),
        eq(friendships.addresseeId, session.user.id),
        eq(friendships.status, "pending"),
      ),
    );

  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db
    .delete(friendships)
    .where(
      and(
        eq(friendships.id, Number(id)),
        or(
          eq(friendships.requesterId, session.user.id),
          eq(friendships.addresseeId, session.user.id),
        ),
      ),
    );

  return Response.json({ ok: true });
}
