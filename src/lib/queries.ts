import { asc } from "drizzle-orm";
import { db } from "@/db";
import { intentOptions, people, places, socialTables } from "@/db/schema";
import type {
  IntentKey,
  IntentOption,
  PersonMatch,
  Place,
  SocialTable,
} from "@/types";

export async function getAllData() {
  const [intentRows, placeRows, peopleRows, tableRows] = await Promise.all([
    db.select().from(intentOptions).orderBy(asc(intentOptions.sortOrder)),
    db.select().from(places).orderBy(asc(places.sortOrder)),
    db.select().from(people).orderBy(asc(people.sortOrder)),
    db.select().from(socialTables),
  ]);

  const intentOptionsList: IntentOption[] = intentRows.map((r) => ({
    key: r.key as IntentKey,
    query: r.query,
    label: r.label,
    thesis: r.thesis,
    ranking: r.ranking,
  }));

  const placesByIntent = {} as Record<IntentKey, Place[]>;
  for (const r of placeRows) {
    const key = r.intent as IntentKey;
    if (!placesByIntent[key]) placesByIntent[key] = [];
    placesByIntent[key].push({
      name: r.name,
      category: r.category,
      distance: r.distance,
      eta: r.eta,
      price: r.price,
      score: r.score,
      vibe: r.vibe,
      bestFor: r.bestFor,
      why: r.why,
      signals: r.signals,
      followThrough: {
        invitation: r.followThroughInvitation,
        ritual: r.followThroughRitual,
        friction: r.followThroughFriction,
      },
      x: r.x,
      y: r.y,
      color: r.color,
    });
  }

  const peopleByIntent = {} as Record<IntentKey, PersonMatch[]>;
  for (const r of peopleRows) {
    const key = r.intent as IntentKey;
    if (!peopleByIntent[key]) peopleByIntent[key] = [];
    peopleByIntent[key].push({
      name: r.name,
      initials: r.initials,
      distance: r.distance,
      availability: r.availability,
      match: r.match,
      socialMode: r.socialMode,
      wants: r.wants,
      repeatSignal: r.repeatSignal,
      opener: r.opener,
      color: r.color,
    });
  }

  const tablesByIntent = {} as Record<IntentKey, SocialTable>;
  for (const r of tableRows) {
    tablesByIntent[r.intent as IntentKey] = {
      title: r.title,
      time: r.time,
      size: r.size,
      hostLine: r.hostLine,
      ask: r.ask,
      cadence: r.cadence,
    };
  }

  return { intentOptions: intentOptionsList, placesByIntent, peopleByIntent, tablesByIntent };
}
