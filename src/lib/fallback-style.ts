import type { StyleSpecification } from "maplibre-gl";

/**
 * Warm OpenStreetMap fallback style for when GrabMaps is down.
 * Uses Carto Voyager tiles (prettier + faster CDN than raw OSM)
 * with a light beige background matching the Baiizy palette.
 */
export const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        "https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors · © CARTO",
    },
  },
  layers: [
    {
      id: "baiizy-bg",
      type: "background",
      paint: { "background-color": "#eadfca" },
    },
    {
      id: "carto-tiles",
      type: "raster",
      source: "carto",
      paint: {
        "raster-opacity": 1,
        "raster-saturation": -0.12,
        "raster-hue-rotate": 8,
      },
    },
  ],
};

/** Flag exported so the map page can set flat pitch/bearing when using the fallback. */
export const FALLBACK_BEARING = 0;
export const FALLBACK_PITCH = 0;

export async function loadMapStyle(): Promise<{ style: StyleSpecification; fallback: boolean; reason?: string }> {
  try {
    const res = await fetch("/api/grab/style?theme=basic", { cache: "no-store" });
    if (!res.ok) {
      return { style: FALLBACK_STYLE, fallback: true, reason: `Grab style returned ${res.status}` };
    }
    const data = await res.json();
    if (data && typeof data === "object" && "error" in data) {
      return { style: FALLBACK_STYLE, fallback: true, reason: (data as { message?: string }).message ?? "Grab unavailable" };
    }
    return { style: data as StyleSpecification, fallback: false };
  } catch (e) {
    return { style: FALLBACK_STYLE, fallback: true, reason: e instanceof Error ? e.message : "Network error" };
  }
}
