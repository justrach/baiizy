import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { events, eventInvitees } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const eventId = Number(id);
  const { userIds } = await request.json() as { userIds: string[] };

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return Response.json({ error: "userIds required" }, { status: 400 });
  }

  // Only creator can invite
  const [ev] = await db
    .select({ creatorId: events.creatorId })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.creatorId, session.user.id)))
    .limit(1);
  if (!ev) return Response.json({ error: "Not found or not your event" }, { status: 404 });

  await db
    .insert(eventInvitees)
    .values(userIds.map((uid) => ({ eventId, userId: uid })))
    .onConflictDoNothing();

  return Response.json({ ok: true });
}
