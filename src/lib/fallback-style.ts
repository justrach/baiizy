import type { StyleSpecification } from "maplibre-gl";

/**
 * Warm OpenStreetMap fallback style that matches the Baiizy palette
 * (#eadfca beige background, desaturated + warm-shifted tiles).
 *
 * Used when the Grab style endpoint returns 5xx. Gives us a parchment-ish
 * map that still looks intentional instead of a dead page.
 */
export const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "baiizy-bg",
      type: "background",
      paint: { "background-color": "#eadfca" },
    },
    {
      id: "osm-tiles",
      type: "raster",
      source: "osm",
      paint: {
        "raster-opacity": 0.82,
        "raster-saturation": -0.45,
        "raster-hue-rotate": 18,
        "raster-brightness-max": 0.93,
        "raster-brightness-min": 0.08,
        "raster-contrast": 0.08,
      },
    },
  ],
};

/**
 * Try to fetch Grab's style. If it fails (5xx, network error, or upstream
 * unavailable), return the fallback style and flag it. Used by both
 * /friends/map and /maps pages.
 */
export async function loadMapStyle(): Promise<{ style: StyleSpecification; fallback: boolean; reason?: string }> {
  try {
    const res = await fetch("/api/grab/style?theme=basic", { cache: "no-store" });
    if (!res.ok) {
      const msg = `Grab style returned ${res.status}`;
      return { style: FALLBACK_STYLE, fallback: true, reason: msg };
    }
    const data = await res.json();
    // Our proxy emits {error, message} on exhausted retries — catch that too
    if (data && typeof data === "object" && "error" in data) {
      return { style: FALLBACK_STYLE, fallback: true, reason: (data as { message?: string }).message ?? "Grab unavailable" };
    }
    return { style: data as StyleSpecification, fallback: false };
  } catch (e) {
    return {
      style: FALLBACK_STYLE,
      fallback: true,
      reason: e instanceof Error ? e.message : "Network error",
    };
  }
}
