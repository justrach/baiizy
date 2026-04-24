import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  intents: text("intents").array().notNull().default([]),
  socialMode: text("social_mode").notNull().default("flexible"),
  availability: text("availability").array().notNull().default([]),
  neighborhood: text("neighborhood"),
  neighborhoodLat: doublePrecision("neighborhood_lat"),
  neighborhoodLng: doublePrecision("neighborhood_lng"),
  neighborhoodPoiId: text("neighborhood_poi_id"),
  bio: text("bio"),
  currentLat: doublePrecision("current_lat"),
  currentLng: doublePrecision("current_lng"),
  currentLocationUpdatedAt: timestamp("current_location_updated_at"),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const friendships = pgTable(
  "friendships",
  {
    id: serial("id").primaryKey(),
    requesterId: text("requester_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    addresseeId: text("addressee_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["pending", "accepted", "declined"] })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("unique_friendship").on(t.requesterId, t.addresseeId),
    index("friendships_requester_idx").on(t.requesterId),
    index("friendships_addressee_idx").on(t.addresseeId),
  ],
);

export const intentOptions = pgTable("intent_options", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  query: text("query").notNull(),
  label: text("label").notNull(),
  thesis: text("thesis").notNull(),
  ranking: jsonb("ranking").$type<string[]>().notNull().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const places = pgTable("places", {
  id: serial("id").primaryKey(),
  intent: text("intent").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  distance: text("distance").notNull(),
  eta: text("eta").notNull(),
  price: text("price").notNull(),
  score: integer("score").notNull(),
  vibe: text("vibe").notNull(),
  bestFor: text("best_for").notNull(),
  why: jsonb("why").$type<string[]>().notNull().default([]),
  signals: jsonb("signals")
    .$type<{ label: string; value: number }[]>()
    .notNull()
    .default([]),
  followThroughInvitation: text("follow_through_invitation").notNull(),
  followThroughRitual: text("follow_through_ritual").notNull(),
  followThroughFriction: text("follow_through_friction").notNull(),
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  color: text("color").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const people = pgTable("people", {
  id: serial("id").primaryKey(),
  intent: text("intent").notNull(),
  name: text("name").notNull(),
  initials: text("initials").notNull(),
  distance: text("distance").notNull(),
  availability: text("availability").notNull(),
  match: integer("match").notNull(),
  socialMode: text("social_mode").notNull(),
  wants: text("wants").notNull(),
  repeatSignal: text("repeat_signal").notNull(),
  opener: text("opener").notNull(),
  color: text("color").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const socialTables = pgTable("social_tables", {
  id: serial("id").primaryKey(),
  intent: text("intent").notNull().unique(),
  title: text("title").notNull(),
  time: text("time").notNull(),
  size: text("size").notNull(),
  hostLine: text("host_line").notNull(),
  ask: text("ask").notNull(),
  cadence: text("cadence").notNull(),
});


export const favoritePlaces = pgTable(
  "favorite_places",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    poiId: text("poi_id").notNull(),
    name: text("name").notNull(),
    category: text("category"),
    address: text("address"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("unique_user_favorite").on(t.userId, t.poiId),
    index("favorite_places_user_idx").on(t.userId),
  ],
);

export const checkins = pgTable(
  "checkins",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    poiId: text("poi_id").notNull(),
    name: text("name").notNull(),
    category: text("category"),
    address: text("address"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    note: text("note"),
    rating: integer("rating"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("checkins_user_idx").on(t.userId)],
);


export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    creatorId: text("creator_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    venuePoiId: text("venue_poi_id").notNull(),
    venueName: text("venue_name").notNull(),
    venueAddress: text("venue_address"),
    venueCategory: text("venue_category"),
    venueLat: doublePrecision("venue_lat"),
    venueLng: doublePrecision("venue_lng"),
    startsAt: timestamp("starts_at").notNull(),
    coverImage: text("cover_image"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("events_creator_idx").on(t.creatorId),
    index("events_starts_idx").on(t.startsAt),
  ],
);

export const eventInvitees = pgTable(
  "event_invitees",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["invited", "going", "maybe", "declined"] }).notNull().default("invited"),
    invitedAt: timestamp("invited_at").notNull().defaultNow(),
    respondedAt: timestamp("responded_at"),
  },
  (t) => [
    unique("unique_event_user").on(t.eventId, t.userId),
    index("event_invitees_event_idx").on(t.eventId),
    index("event_invitees_user_idx").on(t.userId),
  ],
);

export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    poiId: text("poi_id").notNull(),
    venueName: text("venue_name").notNull(),
    venueCategory: text("venue_category"),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("unique_user_review").on(t.userId, t.poiId),
    index("reviews_poi_idx").on(t.poiId),
  ],
);
