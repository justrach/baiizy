type GrabSearchPayload = {
  query?: unknown;
  lat?: unknown;
  lon?: unknown;
  limit?: unknown;
  country?: unknown;
};

type JsonRecord = Record<string, unknown>;

type RawSearchResult = {
  keyword: string;
  raw: unknown;
  response: Response;
};

type LivePlace = {
  name: string;
  address: string;
  category: string;
  latitude: number | null;
  longitude: number | null;
  source: string;
};

const GRAB_BASE_URL = "https://maps.grab.com";
const DEFAULT_LOCATION = {
  lat: 1.3521,
  lon: 103.8198,
};
const FALLBACK_QUERY = "restaurants Marina Bay";

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toStringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shouldRetry(status: number) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function resolveIntentQuery(query: string) {
  const normalized = query.toLowerCase();

  if (normalized.includes("quiet") || normalized.includes("work") || normalized.includes("coffee")) {
    return "cafe Marina Bay";
  }

  if (normalized.includes("late") || normalized.includes("supper") || normalized.includes("night")) {
    return "restaurant Marina Bay";
  }

  if (normalized.includes("date") || normalized.includes("romantic")) {
    return "restaurant Marina Bay";
  }

  if (normalized.includes("cheap") || normalized.includes("lunch") || normalized.includes("office")) {
    return "restaurant Raffles Place";
  }

  if (normalized.includes("friend") || normalized.includes("hang") || normalized.includes("browse")) {
    return "cafe Marina Bay";
  }

  return query;
}

function getLocation(item: JsonRecord) {
  const location = isRecord(item.location) ? item.location : {};
  const latitude = toNumber(location.latitude, Number.NaN);
  const longitude = toNumber(location.longitude, Number.NaN);

  return {
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
  };
}

function normalizePlace(item: unknown, index: number): LivePlace {
  if (!isRecord(item)) {
    return {
      name: `Result ${index + 1}`,
      address: String(item),
      category: "Place",
      latitude: null,
      longitude: null,
      source: "grabmaps-raw",
    };
  }

  const name =
    toStringValue(item.name) ||
    toStringValue(item.title) ||
    toStringValue(item.displayName) ||
    `Result ${index + 1}`;

  const address =
    toStringValue(item.formatted_address) ||
    toStringValue(item.formattedAddress) ||
    toStringValue(item.address) ||
    toStringValue(item.street) ||
    "Address not returned";

  const category =
    toStringValue(item.business_type) ||
    toStringValue(item.category) ||
    toStringValue(item.type) ||
    "Place";
  const location = getLocation(item);

  return {
    name,
    address,
    category,
    latitude: location.latitude,
    longitude: location.longitude,
    source: "grabmaps-raw",
  };
}

async function fetchRawSearch(apiKey: string, keyword: string, country: string, lat: number, lon: number, limit: number) {
  const params = new URLSearchParams({
    keyword,
    country,
    location: `${lat},${lon}`,
    limit: String(limit),
  });
  const rawUrl = `${GRAB_BASE_URL}/api/v1/maps/poi/v1/search?${params.toString()}`;

  const response = await fetch(rawUrl, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  });
  const raw = (await response.json().catch(() => null)) as unknown;

  return { keyword, raw, response };
}

async function searchWithFallbacks(
  apiKey: string,
  query: string,
  country: string,
  lat: number,
  lon: number,
  limit: number,
) {
  const resolvedQuery = resolveIntentQuery(query);
  const candidates = Array.from(new Set([resolvedQuery, query, FALLBACK_QUERY]));
  let lastResult: RawSearchResult | null = null;

  for (const candidate of candidates) {
    const maxAttempts = candidate === resolvedQuery ? 2 : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (attempt > 0) {
        await wait(280);
      }

      const result = await fetchRawSearch(apiKey, candidate, country, lat, lon, limit);
      lastResult = result;

      if (result.response.ok || !shouldRetry(result.response.status)) {
        return result;
      }
    }
  }

  return lastResult;
}

export async function POST(request: Request) {
  const apiKey = process.env.GRAB_MAPS_API_KEY;
  const payload = (await request.json().catch(() => ({}))) as GrabSearchPayload;

  const query = toStringValue(payload.query, "restaurants Marina Bay");
  const resolvedQuery = resolveIntentQuery(query);
  const country = toStringValue(payload.country, "SGP");
  const lat = toNumber(payload.lat, DEFAULT_LOCATION.lat);
  const lon = toNumber(payload.lon, DEFAULT_LOCATION.lon);
  const limit = Math.min(Math.max(toNumber(payload.limit, 8), 1), 30);

  const requestShape = {
    query,
    resolvedQuery,
    country,
    lat,
    lon,
    limit,
  };

  if (!apiKey) {
    return Response.json({
      configured: false,
      mode: "missing-key",
      message: "Add GRAB_MAPS_API_KEY to .env.local, then restart npm run dev to try live GrabMaps search.",
      request: requestShape,
      places: [],
    });
  }

  const searchResult = await searchWithFallbacks(apiKey, query, country, lat, lon, limit);

  if (!searchResult || !searchResult.response.ok) {
    return Response.json(
      {
        configured: true,
        mode: "grabmaps-raw-error",
        message: `Raw GrabMaps search failed with ${searchResult?.response.status ?? "unknown status"}.`,
        request: requestShape,
        places: [],
        raw: searchResult?.raw ?? null,
      },
      { status: 502 },
    );
  }

  const { keyword, raw, response } = searchResult;
  const rawPlaces = isRecord(raw) ? getArray(raw.places) : [];
  const places = rawPlaces.slice(0, limit).map((item, index) => normalizePlace(item, index));

  return Response.json({
    configured: true,
    mode: keyword === query ? "raw-poi-search" : "intent-resolved-poi-search",
    status: response.status,
    request: requestShape,
    places,
    resultCount: rawPlaces.length,
    upstreamQuery: keyword,
  });
}
