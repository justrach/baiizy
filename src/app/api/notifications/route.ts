import { headers } from "next/headers";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      payload: notifications.payload,
      read: notifications.read,
      createdAt: notifications.createdAt,
      actorId: notifications.actorId,
      actorName: user.name,
      actorUsername: user.username,
      actorImage: user.image,
    })
    .from(notifications)
    .leftJoin(user, eq(user.id, notifications.actorId))
    .where(eq(notifications.userId, session.user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(30);

  const unread = rows.filter((r) => !r.read).length;
  return Response.json({ notifications: rows, unread });
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { ids?: number[]; all?: boolean };

  if (body.all) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, session.user.id), eq(notifications.read, false)));
    return Response.json({ ok: true });
  }

  if (Array.isArray(body.ids) && body.ids.length > 0) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, session.user.id), inArray(notifications.id, body.ids)));
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Missing ids or all" }, { status: 400 });
}
