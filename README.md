# Baiizy

Baiizy is an intent-aware local discovery prototype.

The product idea is simple: discovery should not stop at finding a nearby place. The more useful product loop is:

```txt
places -> people -> repeat
```

A user might type:

```txt
quiet cafe to work from
late-night supper near me
good date spot nearby
cheap lunch around this office
low-pressure friend hang nearby
```

The long-term goal is to rank places for the user's intent, explain why they fit, help the user make a low-pressure invite, and make repeat plans easier after the first meetup.

## Routes

- `/` is the cleaned product/story page for the Baiizy concept.
- `/maps` is the raw GrabMaps test lab.

The `/maps` page currently:

- Loads a real MapLibre map from the GrabMaps style JSON proxy.
- Calls the raw GrabMaps POI search endpoint through a local server route.
- Renders returned POIs as clickable pins and result cards.
- Keeps the API key server-side instead of exposing it in the browser.

## Raw API Setup

Create a local env file:

```bash
cp .env.example .env.local
```

Add your GrabMaps key in `.env.local`:

```bash
GRAB_MAPS_API_KEY=
```

Start the app:

```bash
npm run dev
```

Open:

```txt
http://localhost:3000/maps
```

## Local API Routes

- `POST /api/grab/search` proxies `https://maps.grab.com/api/v1/maps/poi/v1/search`.
- `GET /api/grab/style` proxies `https://maps.grab.com/api/style.json`.

Example search payload:

```json
{
  "query": "restaurants Marina Bay",
  "country": "SGP",
  "lat": 1.3521,
  "lon": 103.8198,
  "limit": 8
}
```

## Product Direction

Baiizy is meant to move beyond top-of-funnel IRL discovery. The important downstream problem is follow-through: helping someone turn one meeting into a durable social routine.

Future versions should add:

- Intent scoring for noise, price, seating, hours, comfort, and repeatability.
- Place details enrichment.
- Opt-in people matching around social mode and availability.
- Small invite templates.
- Recurring table or ritual creation.

## Verification

Run lint:

```bash
npm run lint
```

Run a production build:

```bash
npm run build
```

## Key Files

- `src/app/page.tsx`: cleaned concept landing page.
- `src/app/maps/page.tsx`: live GrabMaps + MapLibre test page.
- `src/app/api/grab/search/route.ts`: server-side raw POI search proxy.
- `src/app/api/grab/style/route.ts`: server-side style JSON proxy.
- `src/app/globals.css`: global styling, MapLibre CSS import, and marker styles.
