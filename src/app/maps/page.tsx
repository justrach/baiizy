"use client";

import Link from "next/link";
import { loadMapStyle, FALLBACK_BEARING, FALLBACK_PITCH, resolveStyleUrls } from "@/lib/fallback-style";
import maplibregl, {
  type Map as MapLibreMap,
  type Marker as MapLibreMarker,
  type StyleSpecification,
} from "maplibre-gl";
import { useEffect, useRef, useState, type FormEvent } from "react";

type LivePlace = {
  name: string;
  address: string;
  category: string;
  latitude: number | null;
  longitude: number | null;
  source: string;
};

type SearchResponse = {
  configured: boolean;
  mode: string;
  message?: string;
  request: {
    query: string;
    resolvedQuery?: string;
    country: string;
    lat: number;
    lon: number;
    limit: number;
  };
  places: LivePlace[];
  resultCount?: number;
  upstreamQuery?: string;
};

type StyleStatus = {
  ok: boolean;
  layers: number;
  sources: string[];
  message: string;
};

type RawMapStyle = StyleSpecification & {
  layers?: unknown[];
  sources?: Record<string, unknown>;
};

const defaultQuery = "restaurants Marina Bay";
const defaultLocation = {
  lat: 1.3521,
  lon: 103.8198,
};

const quickIntents = [
  "quiet cafe to work from",
  "late-night supper near me",
  "good date spot nearby",
  "cheap lunch around this office",
];

const mapSignals = [
  ["Live style", "GrabMaps tiles"],
  ["Anchor", "Singapore"],
  ["Mode", "Intent search"],
];

async function searchPlaces(query: string) {
  const response = await fetch("/api/grab/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      country: "SGP",
      lat: defaultLocation.lat,
      lon: defaultLocation.lon,
      limit: 8,
    }),
  });
  const data = (await response.json()) as SearchResponse;

  if (!response.ok) {
    throw new Error(data.message ?? "Raw GrabMaps search failed.");
  }

  return data;
}

async function fetchMapStyle(origin: string) {
  const res = await loadMapStyle();
  const style = res.fallback ? resolveStyleUrls(res.style, origin) : res.style;
  return { style: style as unknown as RawMapStyle, fallback: res.fallback, reason: res.reason, isRaster: res.fallbackKind === "carto-raster" };
}

function describeStyle(style: RawMapStyle): StyleStatus {
  return {
    ok: true,
    layers: Array.isArray(style.layers) ? style.layers.length : 0,
    sources: Object.keys(style.sources ?? {}),
    message: "Raw GrabMaps style is live.",
  };
}

function flyToPlace(map: MapLibreMap | null, place: LivePlace) {
  if (map === null || place.latitude === null || place.longitude === null) {
    return;
  }

  map.flyTo({
    center: [place.longitude, place.latitude],
    duration: 650,
    essential: true,
    pitch: 42,
    zoom: Math.max(map.getZoom(), 13.6),
  });
}

function coordinateLabel(place: LivePlace | null) {
  if (place?.latitude === null || place?.longitude === null || place === null) {
    return "No coordinates yet";
  }

  return `${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}`;
}

export default function MapsPage() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Array<{ marker: MapLibreMarker; resultIndex: number }>>([]);
  const [query, setQuery] = useState(defaultQuery);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [styleStatus, setStyleStatus] = useState<StyleStatus | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectedPlace = result?.places[selectedIndex] ?? result?.places[0] ?? null;

  const runSearch = async (nextQuery = query) => {
    setLoading(true);
    setError("");
    setQuery(nextQuery);

    try {
      const data = await searchPlaces(nextQuery);
      setResult(data);
      setSelectedIndex(0);

      if (!data.configured) {
        setError(data.message ?? "GrabMaps API key is not configured.");
      }
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  };

  const selectPlace = (place: LivePlace, index: number) => {
    setSelectedIndex(index);
    flyToPlace(mapRef.current, place);
  };

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;

    const initMap = async () => {
      try {
        const { style, fallback, reason, isRaster } = await fetchMapStyle(window.location.origin);

        if (cancelled || !mapContainerRef.current) {
          return;
        }

        map = new maplibregl.Map({
          attributionControl: false,
          bearing: isRaster ? FALLBACK_BEARING : -12,
          center: [103.8602, 1.2834],
          container: mapContainerRef.current,
          pitch: isRaster ? FALLBACK_PITCH : 42,
          style,
          zoom: 12.4,
        });

        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
        mapRef.current = map;
        map.once("load", () => {
          map?.resize();
        });
        requestAnimationFrame(() => {
          map?.resize();
        });
        setStyleStatus({
          ...describeStyle(style),
          message: fallback ? `Using OpenStreetMap (${reason ?? "Grab down"})` : "Raw GrabMaps style is live.",
        });
        setMapReady(true);
      } catch (mapError) {
        if (cancelled) {
          return;
        }

        setStyleStatus({
          ok: false,
          layers: 0,
          sources: [],
          message: mapError instanceof Error ? mapError.message : "Could not load the GrabMaps style.",
        });
      }
    };

    void initMap();

    return () => {
      cancelled = true;
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current = [];
      map?.remove();

      if (mapRef.current === map) {
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadInitialSearch = async () => {
      const urlQuery =
        typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("q")?.trim();
      const nextQuery = urlQuery || defaultQuery;

      try {
        const data = await searchPlaces(nextQuery);

        if (cancelled) {
          return;
        }

        setQuery(nextQuery);
        setResult(data);
        setSelectedIndex(0);

        if (!data.configured) {
          setError(data.message ?? "GrabMaps API key is not configured.");
        }
      } catch (initialError) {
        if (!cancelled) {
          setError(initialError instanceof Error ? initialError.message : "Search failed.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadInitialSearch();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (!mapReady || !map || !result) {
      return;
    }

    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current = [];

    const bounds = new maplibregl.LngLatBounds();
    let firstCoordinate: [number, number] | null = null;
    let markerCount = 0;

    result.places.forEach((place, index) => {
      if (place.latitude === null || place.longitude === null) {
        return;
      }

      const coordinate: [number, number] = [place.longitude, place.latitude];
      const markerElement = document.createElement("button");
      markerElement.type = "button";
      markerElement.className = "live-map-marker";
      markerElement.textContent = String(index + 1);
      markerElement.setAttribute("aria-label", `Select ${place.name}`);
      markerElement.addEventListener("click", () => selectPlace(place, index));

      if (index === 0) {
        markerElement.classList.add("is-selected");
      }

      const marker = new maplibregl.Marker({ anchor: "center", element: markerElement })
        .setLngLat(coordinate)
        .addTo(map);

      markersRef.current.push({ marker, resultIndex: index });
      bounds.extend(coordinate);
      firstCoordinate ??= coordinate;
      markerCount += 1;
    });

    if (markerCount === 1 && firstCoordinate) {
      map.flyTo({ center: firstCoordinate, duration: 700, pitch: 42, zoom: 14.2 });
    } else if (markerCount > 1) {
      map.fitBounds(bounds, {
        bearing: -8,
        duration: 850,
        maxZoom: 14.7,
        padding: 96,
        pitch: 36,
      });
    }

    return () => {
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current = [];
    };
  }, [mapReady, result]);

  useEffect(() => {
    markersRef.current.forEach(({ marker, resultIndex }) => {
      marker.getElement().classList.toggle("is-selected", resultIndex === selectedIndex);
    });
  }, [selectedIndex]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runSearch(query);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#07110c] text-[#fffaf0]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(215,156,82,0.28),transparent_28%),radial-gradient(circle_at_88%_18%,rgba(31,107,93,0.36),transparent_32%),linear-gradient(135deg,#07110c_0%,#132218_46%,#090d0b_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,250,240,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,250,240,0.08)_1px,transparent_1px)] [background-size:72px_72px]" />

      <div className="relative mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between rounded-full border border-[#fffaf0]/12 bg-[#fffaf0]/9 px-4 py-3 shadow-[0_20px_80px_rgba(0,0,0,0.18)] backdrop-blur-xl">
          <Link href="/" className="flex items-center gap-3" aria-label="Baiizy home">
            <span className="grid size-10 place-items-center rounded-full bg-[#fffaf0] text-sm font-black text-[#172019]">
              B
            </span>
            <span>
              <span className="block text-sm font-black uppercase tracking-[0.24em]">Baiizy</span>
              <span className="block text-xs font-bold text-[#d7c9a8]">pretty maps lab</span>
            </span>
          </Link>
          <Link
            href="/"
            className="rounded-full border border-[#fffaf0]/16 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#fffaf0] transition hover:bg-[#fffaf0] hover:text-[#172019]"
          >
            Back home
          </Link>
        </header>

        <section className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
          <aside className="rounded-[2rem] border border-[#fffaf0]/12 bg-[#16241b]/86 p-5 shadow-[0_30px_100px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
            <div className="rounded-[1.5rem] bg-[#fffaf0] p-4 text-[#172019] shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#8a6d2f]">Live map search</p>
              <h1 className="mt-3 font-serif text-5xl font-black leading-[0.9] tracking-[-0.075em]">
                Pretty map, real places.
              </h1>
              <p className="mt-4 text-sm font-bold leading-6 text-[#536055]">
                This is the clean testing surface: MapLibre renders the GrabMaps style, and our server route pulls live
                POIs for the current intent.
              </p>
            </div>

            <form onSubmit={submitSearch} className="mt-4 rounded-[1.5rem] border border-[#fffaf0]/10 bg-[#fffaf0]/10 p-3">
              <label className="sr-only" htmlFor="maps-query">
                Search query
              </label>
              <input
                id="maps-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-h-14 w-full rounded-2xl border border-[#fffaf0]/18 bg-[#fffaf0] px-4 text-base font-black text-[#172019] outline-none placeholder:text-[#8b958c] focus:ring-4 focus:ring-[#d79c52]/35"
                placeholder="restaurants Marina Bay"
              />
              <button className="mt-3 min-h-12 w-full rounded-2xl bg-[#d79c52] px-4 text-sm font-black uppercase tracking-[0.18em] text-[#172019] shadow-[0_14px_40px_rgba(215,156,82,0.24)] transition hover:bg-[#e7b46b]">
                {loading ? "Searching" : "Search map"}
              </button>
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              {quickIntents.map((intent) => (
                <button
                  key={intent}
                  type="button"
                  onClick={() => void runSearch(intent)}
                  className="rounded-full border border-[#fffaf0]/12 bg-[#fffaf0]/8 px-3 py-2 text-left text-xs font-black text-[#f3ead8] transition hover:border-[#d79c52] hover:bg-[#d79c52] hover:text-[#172019]"
                >
                  {intent}
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {mapSignals.map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-[#fffaf0]/9 p-3">
                  <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[#d7c9a8]">{label}</p>
                  <p className="mt-2 text-sm font-black leading-5">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[1.35rem] border border-[#fffaf0]/10 bg-[#fffaf0]/8 p-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#d7c9a8]">POI search</p>
                <p className="mt-2 text-3xl font-black">{result?.resultCount ?? 0}</p>
                <p className="mt-1 text-sm font-bold text-[#d7c9a8]">raw results from GrabMaps</p>
              </div>
              <div className="rounded-[1.35rem] border border-[#fffaf0]/10 bg-[#fffaf0]/8 p-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#d7c9a8]">Style JSON</p>
                <p className="mt-2 text-3xl font-black">{styleStatus?.layers ?? 0}</p>
                <p className="mt-1 text-sm font-bold text-[#d7c9a8]">map layers loaded</p>
              </div>
            </div>

            {error ? (
              <div className="mt-4 rounded-[1.35rem] bg-[#b6522b]/24 p-4 text-sm font-black leading-6 text-[#ffe7d2]">
                {error}
              </div>
            ) : null}
          </aside>

          <section className="rounded-[2.25rem] border border-[#fffaf0]/12 bg-[#fffaf0]/9 p-3 shadow-[0_35px_120px_rgba(0,0,0,0.34)] backdrop-blur-xl">
            <div className="relative h-[calc(100vh-8.25rem)] min-h-[720px] overflow-hidden rounded-[1.8rem] border border-[#fffaf0]/10 bg-[#dce8df]">
              <div className="absolute inset-0">
                <div ref={mapContainerRef} className="h-full w-full" />
              </div>
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,250,240,0.08)_0%,transparent_22%,transparent_70%,rgba(7,17,12,0.18)_100%)]" />

              <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-wrap gap-2">
                <div className="rounded-full border border-[#fffaf0]/16 bg-[#07110c]/72 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#fffaf0] shadow-xl backdrop-blur-xl">
                  GrabMaps live
                </div>
                <div className="rounded-full border border-[#fffaf0]/16 bg-[#fffaf0]/88 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#172019] shadow-xl backdrop-blur-xl">
                  {styleStatus?.ok ? `${styleStatus.layers} layers` : "loading style"}
                </div>
                {result?.upstreamQuery ? (
                  <div className="rounded-full border border-[#fffaf0]/16 bg-[#fffaf0]/88 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#172019] shadow-xl backdrop-blur-xl">
                    query: {result.upstreamQuery}
                  </div>
                ) : null}
              </div>

              {!styleStatus?.ok ? (
                <div className="absolute inset-0 z-20 grid place-items-center bg-[#eadfca] p-6 text-center">
                  <div className="max-w-sm rounded-[1.5rem] bg-[#fffaf0] p-5 shadow-xl">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8a6d2f]">Map loading</p>
                    <p className="mt-2 text-sm font-black leading-6 text-[#536055]">
                      {styleStatus?.message ?? "Fetching the raw GrabMaps style JSON."}
                    </p>
                    {styleStatus !== null && !styleStatus.ok ? (
                      <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="mt-4 rounded-2xl bg-[#172019] px-5 py-2 text-xs font-black text-[#fffaf0] hover:bg-[#2b372e] transition"
                      >
                        Retry
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="pointer-events-none absolute bottom-4 left-4 z-10 w-[min(440px,calc(100%-2rem))] rounded-[1.5rem] border border-[#fffaf0]/14 bg-[#07110c]/78 p-4 text-[#fffaf0] shadow-[0_24px_90px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d7c9a8]">Best visible match</p>
                    <h2 className="mt-2 text-xl font-black leading-6 tracking-[-0.04em]">
                      {selectedPlace?.name ?? "Run a search"}
                    </h2>
                  </div>
                  <span className="rounded-full bg-[#d79c52] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#172019]">
                    {selectedPlace?.category ?? "ready"}
                  </span>
                </div>
                <p className="mt-3 text-sm font-bold leading-6 text-[#e9dfc8]">
                  {selectedPlace?.address ?? "Live search results will appear as pins on the map."}
                </p>
                <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-[#d7c9a8]">
                  {coordinateLabel(selectedPlace)}
                </p>
              </div>


            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
