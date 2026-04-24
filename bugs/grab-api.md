# Grab Maps API — Bugs and Workarounds

A log of every issue hit while integrating Grab Maps into Baiizy, what caused each one, and how we worked around it. Scoped to Grab APIs only.

---

## 1. `no healthy upstream` on parallel requests

**Symptom:** Grab endpoints return a plain-text body `no healthy upstream` (HTTP 503). The body is not JSON, so any `.json()` call throws.

**What caused it:** The AI agent in `src/lib/agent.ts` originally did `Promise.all` over 9 parallel calls (3 intents × 3 keyword variants) to `/maps/poi/v1/search`. Grab's upstream routing appears to drop or reject parallel bursts from a single client.

**Evidence:**
```
$ curl https://maps.grab.com/api/v1/maps/poi/v1/search?keyword=cafe...
no healthy upstream
```

**Fix:** Sequence the Grab calls with a `for…await` loop and cap total calls at 3 (one per intent, single-word keyword). See `src/lib/agent.ts:recommendPlaces`. After the fix, candidate count went from 0 → 30+ reliably.

**Still unknown:** Whether this is per-IP, per-API-key, or global load. It reappears occasionally even with sequential calls — a short retry-with-backoff would likely help.

---

## 2. `/maps/place/v2/nearby` returns `no healthy upstream` more often than `/maps/poi/v1/search`

**Symptom:** Calling the nearby endpoint with a simple `location=1.3521,103.8198&radius=1&rankBy=popularity` returned `no healthy upstream` repeatedly, even when the sibling POI search endpoint worked fine.

**What caused it:** Unknown — suspected upstream routing issue specific to the v2 nearby service.

**Fix:** Abandoned the nearby endpoint entirely and route all discovery through `/maps/poi/v1/search?keyword=<category>`. We compensate for the loss of distance-based ranking by biasing via the `location` parameter and computing distance client-side.

---

## 3. No ratings or review counts in the POI response

**Symptom:** User expected Grab ratings to power a "top-rated near me" sort, but no rating/review field exists on the POI object.

**What's actually returned (verified via raw curl):**
```
poi_id, location{latitude,longitude}, name, short_name, formatted_address,
country, country_code, city, cityId, street, house, postcode,
administrative_areas[{type,name}], business_type, category,
opening_hours, time_zone, unit_number, distance, transportation_type
```

No `rating`, `review_count`, or `popularity_score`. Checked both `/maps/poi/v1/search` and (where reachable) `/maps/place/v2/nearby`. The SKILL.md reference doesn't document any ratings endpoint either.

**Fix:** Built our own `reviews` table in Postgres so users post their own ratings. Baiizy now has native `POST /api/reviews` and per-venue aggregate averages.

---

## 4. Map tile PBFs return `502 Bad Gateway`

**Symptom:** Browser console flooded with:
```
AJAXError: Bad Gateway (502):
https://maps.grab.com/api/maps/tiles/v2/vector/internal-poi-v3/13/6460/4067.pbf
```
Multiple tiles at different zoom/x/y coords fail intermittently.

**What caused it:** Grab's vector-tile CDN sporadically fails individual tile requests. MapLibre retries but surfaces the error in the console.

**Fix:** No code change — MapLibre handles this gracefully (tiles retry, map still renders). Documented so the 502s in DevTools aren't mistaken for an app bug.

---

## 5. Sprite images referenced by style.json aren't loaded

**Symptom:** MapLibre warnings:
```
Image "movie_or_theatre_11" could not be loaded. Please make sure you have
added the image with map.addImage() or a "sprite" property in your style.
Image "street_11" could not be loaded.
```

**What caused it:** The style JSON returned by `GET /api/style.json` references sprite icons (movie_or_theatre_11, street_11, etc.) but the sprite URL is either missing or pointing to a path the browser can't resolve with the Bearer header attached.

**Fix:** Cosmetic warnings only — icons fall back to default symbols. If we want real icons, we'd need to fetch the sprite JSON+PNG manually with the Bearer header and register with `map.addImage`. Not blocking.

---

## 6. Coordinate order differs between endpoints

**Symptom:** Easy to silently get wrong results if you mix them up.

**What caused it:** Grab is inconsistent:
- `/maps/poi/v1/search?location=LAT,LNG` — **lat first**
- `/maps/place/v2/nearby?location=LAT,LNG` — **lat first**
- `/maps/eta/v1/direction?coordinates=LNG,LAT` — **lng first** by default (or pass `lat_first=true`)
- Response body uses `{ latitude, longitude }` as object fields everywhere.

**Fix:** Centralized all coordinate handling in `src/lib/agent.ts` and `src/app/api/grab/autocomplete/route.ts`. Always build the `location` query param as `${lat},${lng}` and always read `p.location.latitude` / `p.location.longitude` from responses. Never pass raw coords through helpers.

---

## 7. Multi-word keywords return fewer results than single-word

**Symptom:** Keyword `"quiet cafe"` → 0-2 results. Keyword `"cafe"` → 12-16 results. Keyword `"coworking cafe"` → 0 results.

**What caused it:** Grab's search appears to do exact tokenization rather than keyword expansion. Descriptive modifiers ("quiet", "coworking") don't match most POI entries.

**Fix:** In the AI agent, map each intent to a **single broad category word** (`cafe`, `lunch`, `restaurant`, `wine bar`, `bookstore`). Semantic ranking is then done by the LLM, not by Grab. Defined in `INTENT_KEYWORDS_SIMPLE` in `src/lib/agent.ts`.

---

## 8. Country filter is strict — wrong country returns nothing

**Symptom:** Forgetting `country=SGP` returned mixed / empty results.

**What caused it:** Grab requires an explicit country code (ISO 3166 alpha-3, e.g. `SGP`). Without it, the endpoint returns empty even for valid SGP coordinates.

**Fix:** Hardcoded `country: "SGP"` in all search calls. If we expand beyond Singapore, this needs to become a per-user setting derived from their neighborhood.

---

## 9. Rate limit: 100/minute with tight headroom

**Observed headers:**
```
x-ratelimit-limit: 100
x-ratelimit-remaining: 199
```

The `remaining` being **greater than** `limit` is odd — suggests two overlapping buckets (short + long window). But 100 requests/minute is the practical cap.

**What caused it:** Running the E2E test script in rapid succession hit sporadic 503s that correlate with this header.

**Fix:** For now, cap agent calls at 3 keyword searches per recommendation run. For multi-user production, add Redis-backed per-user rate limiting with retry+backoff.

---

## 10. `guide_info` field is inconsistently populated

**Symptom:** Some POIs return `guide_info: { guide_header, guide_body }` with useful "how to find the entrance" text, others return `guide_info: {}` or omit the field entirely.

**What caused it:** Grab only fills this field for POIs that have been manually annotated (usually mall entrances, pickup points, etc.).

**Fix:** Treat `guide_info` as optional. Don't show the UI chip if it's empty.

---

## 11. `opening_hours` comes back as a JSON-stringified blob

**Symptom:** The field is a string like:
```
"opening_hours": "{\"friday\":[[\"09:00\",\"23:00\"]],\"monday\":[[\"09:00\",\"23:00\"]]...}"
```

— a JSON string inside the JSON response, not a parsed object.

**What caused it:** Grab serializes this server-side and never unwraps it.

**Fix:** When we need to use opening hours, `JSON.parse(p.opening_hours)` before reading. Baiizy doesn't use this field yet, but noted for when we want to highlight "open now" in recommendations.

---

## 12. Style JSON endpoint rejects `?key=` query auth

**Symptom:** Some docs / demos suggest appending `?key=<API_KEY>` to `https://maps.grab.com/api/style.json`. This returns 401 / 403.

**What caused it:** Grab only accepts the Bearer header for the style endpoint. The `?key=` query pattern is unsupported (noted in SKILL.md §2.8 and §6).

**Fix:** Always:
```ts
fetch("https://maps.grab.com/api/style.json", {
  headers: { Authorization: `Bearer ${apiKey}` }
}).then(r => r.json())
```
and pass the parsed object (not a URL string) to MapLibre's `style` option. See `src/app/api/grab/style/route.ts` for our proxy pattern.

---

## 13. Response shape can vary across endpoints

**Symptom:** Grab responses use different top-level keys:
- `/maps/poi/v1/search` → `{ places: [...], renders, areas, uuid, is_confident }`
- `/maps/place/v2/nearby` → similar but the `renders` / `areas` fields can be missing
- Some calls wrapped in `{ data: { ... } }`, some not

**What caused it:** Different endpoint versions evolved separately.

**Fix:** Our `src/app/api/grab/search/route.ts` has a `collectCandidateItems` helper that walks multiple nesting patterns (`data.places`, `result.places`, `result.structuredContent.places`, etc.) and merges them. Keep that pattern for any new endpoint.

---

## Open questions / things to watch

- **Why does the agent sometimes get 0 candidates even when curl from the same box works?** Suspect per-process fetch behavior or the Bearer header getting stripped in edge cases. Currently manifests as empty recommendations with no logged error.
- **Is there a private API for ratings/reviews?** Worth asking Grab if any paid tier exposes this — would unlock a better ranking signal than pure category matching.
- **Per-IP vs per-key rate limits?** Unclear whether refreshing the API key resets the window.
- **Nearby endpoint instability** — if it becomes reliable, re-enable in agent for better distance-sorted candidates.


---

## 14. `GET /api/style.json` returns 503 intermittently

**Symptom:** The `/maps` page stalls on "MAP LOADING — Style endpoint returned 503." Reloading immediately sometimes succeeds, sometimes fails again. Single user, single browser.

**What caused it:** Grab's style service returns `503 Service Unavailable` under upstream pressure. Same flavor of "no healthy upstream" seen on the POI endpoint (#1), but this one breaks the whole map render since MapLibre can't initialize without a style.

**Verification — was up a minute later:**
```
$ for i in 1 2 3; do curl -o /dev/null -s -w "%{http_code}\n" \
    -H "Authorization: Bearer $KEY" \
    "https://maps.grab.com/api/style.json?theme=basic"; done
200
200
200
```

**Fix (code):**
1. `src/app/api/grab/style/route.ts` now retries up to **4 times with exponential backoff** (250ms → 500ms → 1000ms) on any 5xx response. Client-facing failures return a structured JSON error instead of the raw Grab text body.
2. `src/app/maps/page.tsx` loading card now renders a **Retry button** when `styleStatus.ok === false`, so the user can kick another attempt without hard-refreshing.
3. Applied the same retry pattern to `src/app/api/grab/autocomplete/route.ts` (3 attempts) since it hits the same POI backend.

**Still unresolved:** Grab doesn't publish which region / which internal service is failing. Our retry masks transient blips but doesn't help during extended outages. If we need graceful degradation for a full outage, consider shipping a cached fallback style (last-known-good style JSON persisted in Postgres / R2) that gets served when upstream 5xx's exceed N attempts.
