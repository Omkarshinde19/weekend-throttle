import { useEffect, useRef, useState } from "react";
import maplibregl, { GeoJSONSource, LngLatBoundsLike, Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Recommendation, Route, Viewpoint } from "../../api/types";
import { PUNE, useStore } from "../../state/store";

const STYLE = "https://tiles.openfreemap.org/styles/positron";

const STOP_GLYPH: Record<string, string> = {
  chai_tapri: "☕",
  dhaba: "🍛",
  restaurant: "🍽",
  biker_cafe: "🏍",
  fuel: "⛽",
  viewpoint_parking: "📷",
  mechanic: "🔧",
};

type FC = GeoJSON.FeatureCollection;
const empty: FC = { type: "FeatureCollection", features: [] };

/** Restyle the neutral basemap into the dashboard's stone/sand palette. */
function warmBasemap(map: MLMap) {
  for (const layer of map.getStyle().layers ?? []) {
    const id = layer.id;
    try {
      if (layer.type === "background") map.setPaintProperty(id, "background-color", "#efe9e0");
      else if (layer.type === "fill" && /water/.test(id)) map.setPaintProperty(id, "fill-color", "#cdd6d6");
      else if (layer.type === "fill" && /park|wood|forest|grass|landcover/.test(id)) map.setPaintProperty(id, "fill-color", "#e2dfcf");
      else if (layer.type === "fill") map.setPaintProperty(id, "fill-color", "#ebe4d9");
      else if (layer.type === "line" && /road|highway|street|path|track/.test(id)) map.setPaintProperty(id, "line-color", "#fbf7f0");
      else if (layer.type === "line" && /water|river|stream/.test(id)) map.setPaintProperty(id, "line-color", "#c3cfd0");
      else if (layer.type === "line" && /boundary/.test(id)) map.setPaintProperty(id, "line-color", "#cbbfae");
      else if (layer.type === "symbol") {
        map.setPaintProperty(id, "text-color", "#7c7366");
        map.setPaintProperty(id, "text-halo-color", "#f5f0e9");
      }
    } catch {
      // Some layers don't support every property; leave them as they are.
    }
  }
}

/** A wedge showing which way a viewpoint looks: centre ±22°, ~3 km long. */
function cone(v: Viewpoint, aligned: number): GeoJSON.Feature {
  const ring: [number, number][] = [[v.lng, v.lat]];
  const km = 3;
  for (let a = v.facing_deg - 22; a <= v.facing_deg + 22; a += 4) {
    const rad = (a * Math.PI) / 180;
    ring.push([
      v.lng + (Math.sin(rad) * km) / (111.32 * Math.cos((v.lat * Math.PI) / 180)),
      v.lat + (Math.cos(rad) * km) / 110.57,
    ]);
  }
  ring.push([v.lng, v.lat]);
  return { type: "Feature", properties: { aligned }, geometry: { type: "Polygon", coordinates: [ring] } };
}

function line(route: Route, props: Record<string, unknown>): GeoJSON.Feature {
  return { type: "Feature", properties: { id: route.id, ...props }, geometry: { type: "LineString", coordinates: route.geometry ?? [] } };
}

export function RideMap({ recs, selected }: { recs: Recommendation[]; selected: number }) {
  const holder = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const select = useStore((s) => s.select);
  const excluded = useStore((s) => s.result?.excluded);
  const allRoutes = useStore((s) => s.allRoutes);
  const sunAz = useStore((s) => s.result?.context.derived);

  useEffect(() => {
    setReady(false);
    const map = new maplibregl.Map({
      container: holder.current!,
      style: STYLE,
      center: [PUNE.lng - 0.25, PUNE.lat + 0.05],
      zoom: 8.6,
      attributionControl: { compact: true },
      cooperativeGestures: true, // page scroll stays page scroll; ctrl/⌘ + scroll zooms
    });
    mapRef.current = map;
    if (import.meta.env.DEV) (window as unknown as { __map: MLMap }).__map = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    let removed = false;
    map.on("error", (e) => {
      const msg = String(e.error?.message ?? e.error);
      if (removed || /abort/i.test(msg)) return; // StrictMode tears the first map down mid-load
      console.warn("[map]", msg);
      if (!map.isStyleLoaded()) setFailed(true);
    });
    map.on("load", () => {
      warmBasemap(map);
      map.addSource("excluded", { type: "geojson", data: empty });
      map.addSource("routes", { type: "geojson", data: empty });
      map.addSource("cones", { type: "geojson", data: empty });
      map.addLayer({
        id: "excluded",
        type: "line",
        source: "excluded",
        paint: { "line-color": "#9a8f80", "line-width": 2, "line-opacity": 0.45, "line-dasharray": [1.5, 2] },
      });
      map.addLayer({
        id: "cones",
        type: "fill",
        source: "cones",
        paint: { "fill-color": "#e0a458", "fill-opacity": ["+", 0.08, ["*", 0.32, ["get", "aligned"]]] },
      });
      map.addLayer({
        id: "routes-casing",
        type: "line",
        source: "routes",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#fffaf2", "line-width": ["case", ["get", "selected"], 11, 6] },
      });
      map.addLayer({
        id: "routes",
        type: "line",
        source: "routes",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["case", ["get", "selected"], "#a8643a", "#47423b"],
          "line-width": ["case", ["get", "selected"], 5, 2.5],
          "line-opacity": ["case", ["get", "selected"], 1, 0.55],
        },
      });
      map.addLayer({
        id: "routes-glow",
        type: "line",
        source: "routes",
        filter: ["==", ["get", "selected"], true],
        paint: { "line-color": "#f2b38b", "line-width": 16, "line-opacity": 0.35, "line-blur": 8 },
      });
      map.moveLayer("routes-glow", "routes-casing");
      map.on("click", "routes", (e) => {
        const rank = e.features?.[0]?.properties?.rank;
        if (typeof rank === "number") select(rank - 1);
      });
      map.on("mouseenter", "routes", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "routes", () => (map.getCanvas().style.cursor = ""));

      const home = document.createElement("div");
      home.className = "map-home";
      home.innerHTML = "<span></span>Pune";
      new maplibregl.Marker({ element: home }).setLngLat([PUNE.lng, PUNE.lat]).addTo(map);
      setReady(true);
    });
    return () => {
      removed = true;
      map.remove();
    };
  }, [select]);

  useEffect(() => {
    const map = mapRef.current;
    const routesSrc = map?.getSource("routes") as GeoJSONSource | undefined;
    if (!map || !ready || !routesSrc) return;
    const current = recs[selected];

    routesSrc.setData({
      type: "FeatureCollection",
      // Selected route last so it draws on top.
      features: recs
        .map((r) => line(r.route, { rank: r.rank, selected: r.rank - 1 === selected }))
        .sort((a, b) => Number(a.properties!.selected) - Number(b.properties!.selected)),
    });

    const ex = new Set(excluded?.map((e) => e.route_id));
    (map.getSource("excluded") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: allRoutes.filter((r) => ex.has(r.id)).map((r) => line(r, {})),
    });

    const target = sunAz?.photo_target === "sunrise" ? sunAz.sunrise_azimuth : sunAz?.sunset_azimuth ?? 270;
    (map.getSource("cones") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: (current?.route.viewpoints ?? []).map((v) => {
        const diff = Math.abs(((v.facing_deg - target + 540) % 360) - 180);
        return cone(v, Math.max(0, Math.cos((diff * Math.PI) / 180)));
      }),
    });

    markers.current.forEach((m) => m.remove());
    markers.current = (current?.pitstops ?? []).map((p) => {
      const el = document.createElement("div");
      el.className = `map-stop map-stop--${p.role}`;
      el.innerHTML = `<span>${STOP_GLYPH[p.type] ?? "•"}</span><b>${p.eta}</b>`;
      el.title = `${p.name} · ${p.eta}`;
      return new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
    });

    if (current?.route.geometry?.length) {
      const pts = [...current.route.geometry, [PUNE.lng, PUNE.lat]];
      const lngs = pts.map((p) => p[0]);
      const lats = pts.map((p) => p[1]);
      const bounds: LngLatBoundsLike = [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ];
      map.fitBounds(bounds, { padding: { top: 60, bottom: 60, left: 60, right: 60 }, duration: 1100, maxZoom: 11.5 });
    }
  }, [recs, selected, ready, excluded, allRoutes, sunAz]);

  return (
    <div className="ride-map" data-snow-surface>
      <div ref={holder} className="ride-map__canvas" />
      {failed && <div className="ride-map__fallback">Map tiles couldn't load — check your connection.</div>}
      <div className="ride-map__legend">
        <span>
          <i className="lg lg--sel" /> Selected
        </span>
        <span>
          <i className="lg lg--alt" /> Alternatives
        </span>
        <span>
          <i className="lg lg--ex" /> Ruled out
        </span>
        <span>
          <i className="lg lg--cone" /> Viewpoint facing
        </span>
      </div>
    </div>
  );
}
