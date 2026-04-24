# Baiizy — Project description

**What it is.** A social concierge that helps you actually go out with friends, not just find a cafe. You tell it what kind of hang you're in the mood for — deep work, late supper, low-pressure date, friend walk — and it answers with three real places nearby, the reason each one fits, a concrete low-pressure opener ("Text them: coffee at 10, leave by noon"), and the distance to each of your friends.

**Who it's for.** People with full calendars and good friends they don't see enough. The kind of person who has four people they'd love to grab lunch with but never actually pulls it together because picking a place is friction and matching availability is friction and proposing plans is friction.

**What we built (features).**

- **Picks tab.** Search freeform ("loud bar after work") or tap an intent pill. GPT-5.4-nano picks 3 places from candidates we pull live from GrabMaps, grounded in your profile, returned in ~4 seconds with a concrete "Your move" action line.
- **Free Together.** One card that shows which availability slots you and your friends all share, with stacked avatars of who's in, and a one-tap "show picks" for each slot.
- **Group-optimal ranking.** When you tap a slot, the agent recomputes the search anchor as the centroid of you + those friends, so Dempsey + Geylang + Tiong Bahru converges on central spots instead of your block. Each recommendation shows per-friend distance chips so you can see the math: `you 0.9km · Maya 1.2km · Priya 1.5km · max 1.5km`.
- **Live friends map (Zenly-style).** Circular avatar markers with animated pulse rings on the real Grab style, showing live friend locations with "last seen 5m ago" timestamps. Tap a marker or a friend card → map flies to zoom 16 to show where they actually are.
- **Nearby banner + ⚡ Tap in.** If any friend is within 1km of your live GPS, a banner appears. One click auto-creates an event at the centroid, finds the nearest cafe via Grab, sets RSVP, routes you both to the shared event page.
- **Events (Luma-style).** Create, invite friends, RSVP, leave reviews on the venue. Place search in the create flow uses the same GrabMaps autocomplete as onboarding.
- **Onboarding with embeddings.** A 4-step flow captures intents, social style, availability, neighborhood (GrabMaps autocomplete, real pinned coords). On save, we generate an OpenAI text-embedding-3-small vector of the user's profile and store it in Postgres via pgvector, indexed with HNSW for similarity-ranked "Suggested friends."
- **Check-ins + reviews.** Each rec has a "Check in here" button; reviews are 1:1 with a POI and aggregate to an average.

**Stack.** Next.js 16 (Turbopack, App Router, React 19) · PostgreSQL (PlanetScale) with Drizzle ORM · pgvector for embeddings · Better-auth with Drizzle adapter · Cloudflare R2 for avatar uploads · Vercel AI Gateway (GPT-5.4-nano primary, Claude Haiku 4.5 + Gemini 2.5 Flash fallbacks) · MapLibre GL JS · GrabMaps for tiles, places, and POI search.

**What judges should pay attention to.**

1. **The framing, not the features.** This isn't "find a cafe." It's "turn an intent into an ask you'd actually send." Every rec ends with a message you could paste into a text. The Grab API gives us the haystack; the product finds the one thing small enough to be doable tonight.
2. **Real group math, visible to the user.** When you tap a Free Together slot, the agent computes the centroid of everyone's `current_lat/lng`, searches GrabMaps from that point, and displays each rec with per-friend distance chips so you can audit the reasoning. It's not a vibe — it's haversine.
3. **A ~3km hard-cap + fallback ladder for recommendations.** Grab's `/poi/v1/search` is relevance-ranked, so a "lunch" search near Kent Ridge returns Jurong Point and Pasir Ris. We filter client-side by haversine distance, hard-cap at 3km, and fall back to the 2 closest within 10km only if the tight radius is empty. Location source and age are surfaced ("Using live GPS · saved 2m ago · 1.2917, 103.7929") so the user sees what's driving the results.
4. **How we survive a flaky upstream.** GrabMaps returned 502 "no healthy upstream" errors on style, tiles, nearby search, and fonts at different points during the hackathon. We documented 15 concrete bugs in `bugs/grab-api.md` and built around them: snapshot their style 1:1 via a scripted capture, route every Grab asset (tiles, sprite, glyphs) through our authenticated `/api/grab/proxy` with 3× exponential-backoff retries, fall back to Protomaps' Noto Sans glyphs when Grab's font service 5xxs, and drop to a warm-tinted Carto Voyager raster style as last resort. `/map3` is a demo page that renders Grab's own 123-layer vector style end-to-end through the proxy. The user never sees a broken map.
5. **A single agent on a budget.** ~4s end-to-end for a recommendation. Prompt is ~400 tokens (down from 1800), two broad-keyword Grab calls sequenced to avoid rate limits, candidates capped at 10 sent to the LLM, output constrained to 3 picks with a Zod schema via `generateObject`. 30s abort controller so it can never hang indefinitely. Vercel AI Gateway fallback models kick in if the primary 5xxs.
6. **Graceful dev-only helpers.** `POST /api/dev/seed-friends` spawns 6 demo users across Singapore with real pravatar photos, pgvector-embedded preferences, and auto-accepted friendships — so any demo account is populated in 2 seconds, including the live map and availability overlap.

**Live pages.** `/login` → `/onboarding` → `/users` (Picks · Suggested · Friends · Requests · Find) · `/users` header → `/friends/map` (Zenly-style) · `/events` (Luma-style) · `/settings` (avatar/username/name) · `/map3` (Grab style 1:1 demo) · `/maps` (original GrabMaps test surface).

**Repo.** [github.com/justrach/baiizy](https://github.com/justrach/baiizy).
