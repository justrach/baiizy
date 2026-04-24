# Baiizy

**Live → [https://www.baiizy.com](https://www.baiizy.com)**
**Repo → [github.com/justrach/baiizy](https://github.com/justrach/baiizy)**
**Judging pitch → [`hackathon/submission.md`](./hackathon/submission.md)**
**Grab API bug log → [`bugs/grab-api.md`](./bugs/grab-api.md)**

A social concierge for the moment when you'd like to see a friend but don't know how to propose it without making it weird. You tell it what kind of hang you want — deep work, late supper, low-pressure date, friend walk — and it answers with three real places nearby, a grounded reason each one fits, a one-sentence opener you could paste into a text, and the distance from every friend who might come along.

---

## For judges — the 90-second tour

Sign up at **[/login](https://www.baiizy.com/login)** → finish the 4-step onboarding → land on `/users`. Then:

1. **`/users` → 🤖 Picks tab.** Tap "📍 Use my location" then "🤖 Get AI recommendations". Three places appear in ~4s, with per-friend distance chips if a group is involved. Or type anything into the search bar ("loud bar after work", "dessert walk with Maya") for a freeform query.
2. **Free Together card** (above the picks). Shows which availability slots you share with friends. Tap a slot → recommendations are scoped to that slot's natural intent and the group centroid.
3. **🪄 Demo button** (in the `/friends/map` header) — seeds 6 fake friends across Singapore with real photos and pgvector-embedded preferences so the rest of the app is populated.
4. **`/friends/map`** — Zenly-style live map. Avatars sit dead-center on real coordinates with a pulse ring; tap one and the camera flies to zoom 16 at 24° pitch. Keyboard shortcuts work after clicking the canvas.
5. **`/map3`** — renders Grab's own `urban-light-partner` vector style end-to-end through our authenticated proxy (123 layers, 4 sources). Live 1:1 copy with font-fallback to Protomaps if Grab's glyph endpoint 5xxs.
6. **🔔 Bell** in the `/users` header — when any friend checks in at a venue, a notification fans out here with their avatar and the place name.

---

## Where GrabMaps is used

Every place in Baiizy comes from Grab:

| Surface | Endpoint |
|---|---|
| Onboarding neighborhood picker | `GET /api/grab/autocomplete?q=` → proxies `/maps/poi/v1/search` |
| Event venue picker (`/events/new`) | same autocomplete |
| AI recommendation agent | `/maps/poi/v1/search` with intent-keyword + live location bias |
| Live map rendering | `/api/style.json` (urban-light-partner), `/api/maps/tiles/v2/vector/karta-v3` + `internal-poi-v3`, `/styles/urban-light/sprite`, `/fonts/{fontstack}/{range}.pbf` — all through our authenticated proxy |
| Spontaneous "⚡ Tap in" events | nearest cafe to the midpoint via `/maps/poi/v1/search` |
| `/map3` demo page | full 123-layer Grab style end-to-end through the proxy |

Bearer auth stays server-side via `src/app/api/grab/proxy/[...path]/route.ts`. The token never touches the client.

---

## The algorithm, made visible

GrabMaps' POI search is relevance-ranked, not distance-ranked — a "lunch" query from Holland Village happily returned Jurong Point fifteen kilometres away. So every recommendation goes through a haversine filter before it reaches the LLM:

- **3 km hard cap** on candidates near the user (or group centroid when friends are selected)
- **Fallback** to the 2 closest within 10 km if the tight radius is empty, so we never silently pad with distant filler
- **Per-friend distance chips** on every rec card so you can audit the math: `you 0.9km · Maya 1.2km · Priya 1.5km · max 1.5km`
- **Location source + age** on the Picks tab: `Using live GPS · saved 2m ago · 1.2917, 103.7929`

The group anchor is the centroid of you + the friends you selected via Free Together or passed in `?friends=`. That changes the results — Dempsey + Geylang + Tiong Bahru converges on central spots instead of any single person's block.

---

## The graceful-degradation story

GrabMaps' style, tile, and font endpoints each returned 502s at different points during the hackathon. 15 distinct issues are catalogued in [`bugs/grab-api.md`](./bugs/grab-api.md). We built around them:

- `src/lib/grab-style-snapshot.json` holds Grab's full `urban-light-partner` style (123 layers, 4 sources), captured while live via `curl`.
- `/api/grab/proxy/[...path]` retries upstream 5xx with exponential backoff (3 attempts, 150 → 600 ms), streams the body back.
- When Grab's font service 5xxs, the proxy transparently substitutes Protomaps' Noto Sans glyphs (Roboto Regular → Noto Sans Regular, Bold → Bold, Medium → Medium, Italic → Italic) with an `x-baiizy-font-fallback` response header so you can see it happening.
- When Grab's tile CDN is fully unreachable, we drop to a warm-tinted Carto Voyager raster style and show an amber "Not GrabMaps · using snapshot" pill above the map.

The user never sees a broken page.

---

## Stack

- **Next.js 16** with Turbopack, React 19, App Router, TypeScript, Tailwind v4
- **PostgreSQL** on PlanetScale via **Drizzle ORM**
- **pgvector** with HNSW index for user-preference similarity
- **better-auth** + Drizzle adapter — email/password, session cookies
- **Cloudflare R2** for avatar uploads (private bucket, served through authenticated proxy)
- **Vercel AI Gateway** — GPT-5.4-nano primary, Claude Haiku 4.5 + Gemini 2.5 Flash fallbacks, 30s abort
- **MapLibre GL JS** on the client
- **GrabMaps** for every geographic surface

---

## Running locally

```bash
git clone https://github.com/justrach/baiizy
cd baiizy
npm install
cp .env.example .env.local    # fill in the keys below
npm run db:push               # create Postgres tables from Drizzle schema
npm run db:seed               # seed intents, places, people (optional, for /maps demo)
npm run dev
```

Required env vars in `.env.local`:

```
DATABASE_URL=postgresql://...            # PlanetScale or any Postgres
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000
OPENAI_API_KEY=sk-proj-...               # text-embedding-3-small
AI_GATEWAY_API_KEY=vck_...               # from vercel.com/dashboard/ai-gateway
GRAB_MAPS_API_KEY=bm_...                 # GrabMaps developer key
GRAB_MAPS_MCP_URL=https://maps.grab.com/api/v1/mcp
R2_BUCKET_NAME=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_ENDPOINT=https://<hash>.r2.cloudflarestorage.com
```

---

## Page & route map

| Route | What |
|---|---|
| `/` | Landing page |
| `/login` | Sign in / create account (better-auth, email+password) |
| `/onboarding` | 4-step preferences + GrabMaps neighborhood pin |
| `/users` | Friends hub: 🤖 Picks · ✨ Suggested · Friends · Requests · Find |
| `/friends/map` | Zenly-style live friends map |
| `/events` | Upcoming events list |
| `/events/new` | Luma-style create flow |
| `/events/[id]` | Event detail + RSVP + reviews |
| `/settings` | Avatar, username, display name |
| `/maps` | Original GrabMaps demo surface |
| `/map3` | Grab `urban-light-partner` 1:1 rendered through our proxy |

Key API routes: `/api/recommendations`, `/api/friends/locations`, `/api/friends/availability`, `/api/events/quick`, `/api/notifications`, `/api/grab/proxy/[...path]`, `/api/grab/autocomplete`, `/api/grab/style`.

---

## License

Apache-2.0 style intent — see [`hackathon/submission.md`](./hackathon/submission.md) for the full pitch.
