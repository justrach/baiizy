"use client";

import Link from "next/link";
import { GRAB_SNAPSHOT_STYLE, resolveStyleUrls } from "@/lib/fallback-style";
import maplibregl, {
  type Map as MapLibreMap,
  type Marker as MapLibreMarker,
  type StyleSpecification,
} from "maplibre-gl";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  defaultMapThemeConceptId,
  mapThemeConcepts,
  type MapPoi,
  type MapThemeConcept,
  type MapThemeConceptId,
} from "./theme-data";

type MutableStyleLayer = {
  id?: string;
  type?: string;
  paint?: Record<string, unknown>;
};

type MutableStyle = StyleSpecification & {
  layers?: MutableStyleLayer[];
};

const marinaBayCenter: [number, number] = [103.8589, 1.2848];
const routeSourceId = "maps3-picked-route";
const routeLayerIds = ["maps3-picked-route-glow", "maps3-picked-route-line"];

function getThemeById(themeId: MapThemeConceptId): MapThemeConcept {
  return mapThemeConcepts.find((theme) => theme.id === themeId) ?? mapThemeConcepts[0];
}

function isThemeConceptId(value: string): value is MapThemeConceptId {
  return mapThemeConcepts.some((theme) => theme.id === value);
}

const defaultTheme = getThemeById(defaultMapThemeConceptId);
const defaultPoiId = defaultTheme.samplePois[0].id;

function cloneStyle(style: StyleSpecification): MutableStyle {
  return JSON.parse(JSON.stringify(style)) as MutableStyle;
}

function setPaint(layer: MutableStyleLayer, property: string, value: unknown) {
  layer.paint = {
    ...(layer.paint ?? {}),
    [property]: value,
  };
}

function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized.length === 3 ? normalized.repeat(2) : normalized, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function buildThemedMapStyle(theme: MapThemeConcept, origin: string): StyleSpecification {
  const style = cloneStyle(GRAB_SNAPSHOT_STYLE);

  for (const layer of style.layers ?? []) {
    const id = layer.id ?? "";

    if (layer.type === "background") {
      setPaint(layer, "background-color", theme.palette.background);
    }

    if (layer.type === "fill") {
      if (id.includes("water")) {
        setPaint(layer, "fill-color", theme.palette.water);
      } else if (
        id.includes("park") ||
        id.includes("grass") ||
        id.includes("wood") ||
        id.includes("wetland") ||
        id.includes("golf")
      ) {
        setPaint(layer, "fill-color", theme.palette.park);
      } else if (id.includes("building")) {
        setPaint(layer, "fill-color", theme.palette.building);
      } else if (id.includes("land") || id.includes("aeroway") || id.includes("highway-area")) {
        setPaint(layer, "fill-color", theme.palette.land);
      }
    }

    if (layer.type === "line") {
      if (id.includes("waterway") || id.includes("ferry")) {
        setPaint(layer, "line-color", withAlpha(theme.palette.water, 0.92));
      } else if (
        id.includes("highway") ||
        id.includes("road") ||
        id.includes("tunnel") ||
        id.includes("bridge") ||
        id.includes("railway")
      ) {
        setPaint(layer, "line-color", theme.palette.road);
      }
    }

    if (layer.type === "symbol") {
      setPaint(layer, "text-color", theme.palette.label);
      setPaint(layer, "text-halo-color", withAlpha(theme.palette.land, 0.9));
      setPaint(layer, "text-halo-width", 1.25);
    }
  }

  return resolveStyleUrls(style as StyleSpecification, origin);
}

function fitThemePois(map: MapLibreMap, theme: MapThemeConcept) {
  const bounds = new maplibregl.LngLatBounds();

  for (const poi of theme.samplePois) {
    bounds.extend([poi.coordinates[0], poi.coordinates[1]]);
  }

  map.fitBounds(bounds, {
    duration: 760,
    maxZoom: 14.5,
    padding: { bottom: 150, left: 78, right: 78, top: 110 },
  });
}

function removeRouteLayer(map: MapLibreMap) {
  for (const layerId of routeLayerIds) {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
  }

  if (map.getSource(routeSourceId)) {
    map.removeSource(routeSourceId);
  }
}

function syncRouteLayer(map: MapLibreMap, theme: MapThemeConcept) {
  removeRouteLayer(map);

  const coordinates = theme.samplePois.map((poi) => [poi.coordinates[0], poi.coordinates[1]]);

  map.addSource(routeSourceId, {
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates,
      },
    },
  });

  map.addLayer({
    id: routeLayerIds[0],
    type: "line",
    source: routeSourceId,
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-blur": 10,
      "line-color": theme.palette.accent,
      "line-opacity": 0.2,
      "line-width": 18,
    },
  });

  map.addLayer({
    id: routeLayerIds[1],
    type: "line",
    source: routeSourceId,
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": theme.palette.accent,
      "line-dasharray": theme.id === "blueprint-bay" ? [1.2, 1] : theme.id === "kopi-heritage" ? [2.4, 1.2] : [1],
      "line-opacity": 0.86,
      "line-width": 4.5,
    },
  });
}

function categoryInitial(category: MapPoi["category"]) {
  const labels: Record<MapPoi["category"], string> = {
    culture: "C",
    food: "F",
    landmark: "L",
    nature: "N",
    transit: "T",
    viewpoint: "V",
  };

  return labels[category];
}

function syncMarkers(
  map: MapLibreMap,
  markers: MapLibreMarker[],
  theme: MapThemeConcept,
  selectedPoiId: string,
  onSelectPoi: (poiId: string) => void,
) {
  markers.forEach((marker) => marker.remove());
  markers.length = 0;

  theme.samplePois.forEach((poi, index) => {
    const markerElement = document.createElement("button");
    const selected = poi.id === selectedPoiId;
    markerElement.type = "button";
    markerElement.className = `maps3-marker${selected ? " is-selected" : ""}`;
    markerElement.style.setProperty("--maps3-marker-accent", theme.palette.accent);
    markerElement.style.setProperty("--maps3-marker-label", theme.palette.label);
    markerElement.style.setProperty("--maps3-marker-land", theme.palette.land);
    markerElement.setAttribute("aria-label", `Select ${poi.name}`);

    const rank = document.createElement("span");
    rank.className = "maps3-marker__rank";
    rank.textContent = String(index + 1);

    const category = document.createElement("span");
    category.className = "maps3-marker__category";
    category.textContent = categoryInitial(poi.category);

    markerElement.append(rank, category);
    markerElement.addEventListener("click", () => {
      onSelectPoi(poi.id);
      map.flyTo({
        center: [poi.coordinates[0], poi.coordinates[1]],
        duration: 650,
        essential: true,
        pitch: 48,
        zoom: 15.2,
      });
    });

    const marker = new maplibregl.Marker({
      anchor: "center",
      element: markerElement,
    })
      .setLngLat([poi.coordinates[0], poi.coordinates[1]])
      .addTo(map);

    markers.push(marker);
  });
}

function formatCoordinates(poi: MapPoi) {
  return `${poi.coordinates[1].toFixed(4)}, ${poi.coordinates[0].toFixed(4)}`;
}

export default function Maps3Page() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const skippedInitialStyleSyncRef = useRef(false);
  const [activeThemeId, setActiveThemeId] = useState<MapThemeConceptId>(defaultMapThemeConceptId);
  const [selectedPoiId, setSelectedPoiId] = useState(defaultPoiId);

  const activeTheme = getThemeById(activeThemeId);
  const selectedPoi = activeTheme.samplePois.find((poi) => poi.id === selectedPoiId) ?? activeTheme.samplePois[0];
  const selectedPoiIndex = Math.max(
    activeTheme.samplePois.findIndex((poi) => poi.id === selectedPoi.id),
    0,
  );

  const themeVariables = {
    "--maps3-accent": activeTheme.palette.accent,
    "--maps3-background": activeTheme.palette.background,
    "--maps3-building": activeTheme.palette.building,
    "--maps3-label": activeTheme.palette.label,
    "--maps3-land": activeTheme.palette.land,
    "--maps3-park": activeTheme.palette.park,
    "--maps3-road": activeTheme.palette.road,
    "--maps3-water": activeTheme.palette.water,
  } as CSSProperties;

  const pickTheme = (themeId: MapThemeConceptId) => {
    const nextTheme = getThemeById(themeId);
    setActiveThemeId(themeId);

    if (!nextTheme.samplePois.some((poi) => poi.id === selectedPoiId)) {
      setSelectedPoiId(nextTheme.samplePois[0].id);
    }
  };

  useEffect(() => {
    let disposed = false;
    let map: MapLibreMap | null = null;

    if (!mapContainerRef.current) {
      return;
    }

    map = new maplibregl.Map({
      attributionControl: false,
      bearing: -9,
      center: marinaBayCenter,
      container: mapContainerRef.current,
      pitch: 42,
      style: buildThemedMapStyle(defaultTheme, window.location.origin),
      zoom: 13.25,
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    map.once("load", () => {
      if (disposed || !map) {
        return;
      }

      syncRouteLayer(map, defaultTheme);
      syncMarkers(map, markersRef.current, defaultTheme, defaultPoiId, setSelectedPoiId);
      fitThemePois(map, defaultTheme);
      requestAnimationFrame(() => map?.resize());
    });

    const resizeMap = () => map?.resize();
    window.addEventListener("resize", resizeMap);

    return () => {
      disposed = true;
      window.removeEventListener("resize", resizeMap);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map?.remove();

      if (mapRef.current === map) {
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (!skippedInitialStyleSyncRef.current) {
      skippedInitialStyleSyncRef.current = true;
      return;
    }

    const refreshDesign = () => {
      syncRouteLayer(map, activeTheme);
      syncMarkers(map, markersRef.current, activeTheme, selectedPoiId, setSelectedPoiId);
      fitThemePois(map, activeTheme);
      requestAnimationFrame(() => map.resize());
    };

    map.setStyle(buildThemedMapStyle(activeTheme, window.location.origin));
    map.once("style.load", refreshDesign);

    return () => {
      map.off("style.load", refreshDesign);
    };
  }, [activeTheme, selectedPoiId]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    syncMarkers(map, markersRef.current, activeTheme, selectedPoiId, setSelectedPoiId);
  }, [activeTheme, selectedPoiId]);

  return (
    <main
      style={themeVariables}
      className="min-h-screen overflow-hidden bg-[var(--maps3-label)] text-[var(--maps3-label)]"
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_10%,var(--maps3-accent),transparent_24%),radial-gradient(circle_at_82%_4%,var(--maps3-water),transparent_32%),linear-gradient(145deg,var(--maps3-label),#08110d_58%,var(--maps3-label))] opacity-90" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.17] [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:74px_74px]" />

      <div className="relative mx-auto flex w-full max-w-[1680px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-[1.6rem] border border-white/14 bg-white/10 px-4 py-3 text-white shadow-[0_24px_90px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
          <Link href="/" className="flex items-center gap-3" aria-label="Baiizy home">
            <span className="grid size-11 place-items-center rounded-full bg-white text-sm font-black text-[var(--maps3-label)]">
              B
            </span>
            <span>
              <span className="block text-sm font-black uppercase tracking-[0.24em]">Baiizy</span>
              <span className="block text-xs font-bold text-white/68">/maps3 design picker</span>
            </span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--maps3-label)]">
              Current pick: {activeTheme.name}
            </span>
            <Link
              href="/maps"
              className="rounded-full border border-white/18 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-white hover:text-[var(--maps3-label)]"
            >
              Live API map
            </Link>
          </div>
        </header>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
          <section className="rounded-[2.2rem] border border-white/14 bg-white/10 p-3 shadow-[0_36px_130px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
            <div className="relative h-[72vh] min-h-[650px] overflow-hidden rounded-[1.85rem] border border-white/12 bg-[var(--maps3-land)]">
              <div className="absolute inset-0">
                <div ref={mapContainerRef} className="h-full w-full" />
              </div>

              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,transparent_28%,transparent_68%,rgba(0,0,0,0.22)_100%)]" />

              <div className="pointer-events-none absolute left-4 right-4 top-4 z-10 flex flex-wrap items-start justify-between gap-3">
                <div className="rounded-[1.4rem] border border-white/20 bg-white/88 px-4 py-3 text-[var(--maps3-label)] shadow-[0_18px_54px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] opacity-65">Picked map</p>
                  <h1 className="mt-1 max-w-[620px] text-3xl font-black leading-[0.95] tracking-[-0.06em] sm:text-5xl">
                    {activeTheme.name}
                  </h1>
                </div>
                <div className="rounded-full border border-white/18 bg-[var(--maps3-accent)] px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
                  Singapore Marina Bay
                </div>
              </div>

              <div className="pointer-events-none absolute bottom-4 left-4 z-10 w-[min(520px,calc(100%-2rem))] rounded-[1.6rem] border border-white/16 bg-[var(--maps3-label)]/88 p-5 text-white shadow-[0_26px_90px_rgba(0,0,0,0.36)] backdrop-blur-2xl">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-white/64">
                      Stop {selectedPoiIndex + 1} / {activeTheme.samplePois.length}
                    </p>
                    <h2 className="mt-2 text-2xl font-black leading-tight tracking-[-0.04em]">{selectedPoi.name}</h2>
                  </div>
                  <span className="rounded-full bg-[var(--maps3-accent)] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-white">
                    {selectedPoi.category}
                  </span>
                </div>
                <p className="mt-3 text-sm font-bold leading-6 text-white/78">{selectedPoi.note}</p>
                <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-white/58">
                  {formatCoordinates(selectedPoi)}
                </p>
              </div>
            </div>
          </section>

          <aside className="rounded-[2.2rem] border border-white/14 bg-white/10 p-4 text-white shadow-[0_36px_130px_rgba(0,0,0,0.32)] backdrop-blur-2xl xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
            <div className="rounded-[1.7rem] bg-white p-5 text-[var(--maps3-label)] shadow-[0_20px_70px_rgba(0,0,0,0.22)]">
              <p className="text-xs font-black uppercase tracking-[0.24em] opacity-55">Pick a map design</p>
              <h2 className="mt-3 font-serif text-5xl font-black leading-[0.88] tracking-[-0.075em]">
                Select the vibe.
              </h2>
              <p className="mt-4 text-sm font-bold leading-6 opacity-70">
                Use the dropdown first. The card Pick buttons below are there for quick visual browsing.
              </p>
              <label
                htmlFor="maps3-theme-dropdown"
                className="mt-5 block text-[0.68rem] font-black uppercase tracking-[0.22em] opacity-58"
              >
                Map style dropdown
              </label>
              <select
                id="maps3-theme-dropdown"
                value={activeThemeId}
                onChange={(event) => {
                  if (isThemeConceptId(event.target.value)) {
                    pickTheme(event.target.value);
                  }
                }}
                className="mt-2 min-h-14 w-full appearance-none rounded-2xl border-2 border-[var(--maps3-label)] bg-[linear-gradient(135deg,#ffffff_0%,var(--maps3-background)_100%)] px-4 pr-12 text-base font-black text-[var(--maps3-label)] outline-none shadow-[0_14px_38px_rgba(0,0,0,0.12)] focus:ring-4 focus:ring-[var(--maps3-accent)]/25"
              >
                {mapThemeConcepts.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.name} - {theme.tagline}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none relative -mt-10 mr-4 flex justify-end text-2xl font-black text-[var(--maps3-label)]">
                v
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {mapThemeConcepts.map((theme) => {
                const picked = theme.id === activeThemeId;
                const cardStyle = {
                  "--theme-accent": theme.palette.accent,
                  "--theme-bg": theme.palette.background,
                  "--theme-building": theme.palette.building,
                  "--theme-label": theme.palette.label,
                  "--theme-land": theme.palette.land,
                  "--theme-park": theme.palette.park,
                  "--theme-road": theme.palette.road,
                  "--theme-water": theme.palette.water,
                } as CSSProperties;

                return (
                  <article
                    key={theme.id}
                    style={cardStyle}
                    className={`rounded-[1.45rem] border p-3 transition ${
                      picked
                        ? "border-white bg-white text-[var(--theme-label)] shadow-[0_24px_74px_rgba(0,0,0,0.26)]"
                        : "border-white/12 bg-white/9 text-white hover:border-white/38"
                    }`}
                  >
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3">
                      <div className="relative min-h-32 overflow-hidden rounded-[1.1rem] border border-black/5 bg-[var(--theme-land)]">
                        <div className="absolute inset-x-0 top-0 h-14 bg-[var(--theme-water)]" />
                        <div className="absolute left-[-12%] top-[42%] h-6 w-[138%] -rotate-12 rounded-full bg-[var(--theme-road)]" />
                        <div className="absolute bottom-3 left-3 size-12 rounded-full bg-[var(--theme-park)]" />
                        <div className="absolute bottom-5 right-4 h-16 w-9 rounded-t-full bg-[var(--theme-building)]" />
                        <div className="absolute left-1/2 top-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-white bg-[var(--theme-accent)] text-sm font-black text-white shadow-xl">
                          {picked ? "✓" : "P"}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] opacity-55">
                              {theme.id === "national-day-bright" ? "Singapore red/white" : theme.visualStyle.baseMap}
                            </p>
                            <h3 className="mt-1 text-xl font-black leading-tight tracking-[-0.035em]">{theme.name}</h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => pickTheme(theme.id)}
                            aria-pressed={picked}
                            className={`shrink-0 rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${
                              picked
                                ? "bg-[var(--theme-label)] text-white"
                                : "bg-[var(--theme-accent)] text-white hover:scale-[1.04]"
                            }`}
                          >
                            {picked ? "Picked" : "Pick"}
                          </button>
                        </div>
                        <p className="mt-2 text-sm font-bold leading-5 opacity-72">{theme.tagline}</p>
                        <p className="mt-3 line-clamp-2 text-xs font-bold leading-5 opacity-58">{theme.singaporeFit}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-4 rounded-[1.6rem] border border-white/12 bg-[var(--maps3-label)]/62 p-4">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/58">Design rule</p>
              <p className="mt-2 text-xl font-black leading-7">{activeTheme.visualStyle.routeTreatment}</p>
              <p className="mt-3 text-sm font-bold leading-6 text-white/68">{activeTheme.description}</p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
