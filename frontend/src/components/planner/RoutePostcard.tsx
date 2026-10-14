import { useMemo } from "react";
import type { Route } from "../../api/types";
import { noise1d, Pt, ridge, rng, toPath } from "../../lib/ridge";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const W = 320;
const H = 240;

const PALETTES = {
  golden: { sky: ["#f6c9a0", "#f2a37e", "#c9768a"], far: "#b98aa0", near: "#5a4258", ground: "#2e2233", sun: "#fff1d6" },
  day: { sky: ["#dbe4ee", "#eadfd3", "#f2e6d8"], far: "#a9b4c4", near: "#6c7a8c", ground: "#3d4552", sun: "#fff8ea" },
  monsoon: { sky: ["#b9c4c9", "#d5dbd8", "#e3e4dc"], far: "#8fa49a", near: "#4f6b58", ground: "#2b3b31", sun: "#f4f4ee" },
  night: { sky: ["#0f1838", "#23305e", "#48508a"], far: "#3a4682", near: "#1b2552", ground: "#0a0f26", sun: "#eef2fb" },
};

/**
 * Generative "photo" for a route — its own ridgeline, water, waterfalls, forest or fort,
 * lit for the conditions the engine is planning for.
 */
export function RoutePostcard({ route, mood = "day" }: { route: Route; mood?: keyof typeof PALETTES }) {
  const art = useMemo(() => {
    const seed = hash(route.id);
    const rand = rng(seed);
    const lift = Math.min(1, route.elevation_gain_m / 900);
    const peaks = 3 + Math.floor(rand() * 3);
    const ctrl = (base: number, amp: number): Pt[] => {
      const pts: Pt[] = [[-20, base]];
      for (let i = 1; i <= peaks; i++) pts.push([(W / (peaks + 1)) * i + (rand() - 0.5) * 30, base - amp * (0.5 + rand() * 0.5)]);
      pts.push([W + 20, base - amp * 0.3]);
      return pts;
    };
    const far = ridge(ctrl(150, 50 + lift * 40), 0.3, 4, seed + 1);
    const near = ridge(ctrl(185, 30 + lift * 70), 0.4 + route.curvature * 0.2, 4, seed + 2);

    // Road: a wiggle whose frequency follows the route's curvature.
    const wig = noise1d(seed + 3, 30 - route.curvature * 18);
    const road: Pt[] = [];
    for (let y = H + 4; y >= 180; y -= 4) {
      const t = (H - y) / 60;
      road.push([W * 0.42 + (wig(y * 3) - 0.5) * 120 * route.curvature * (1 - t * 0.6) + t * 40, y]);
    }

    const has = (t: string) => route.tags.includes(t);
    const fortAt = has("fort") ? near.reduce((a, b) => (b[1] < a[1] ? b : a)) : null;
    return { far, near, road, fortAt, lake: has("lake"), falls: has("waterfalls"), forest: has("forest"), sunX: 80 + rand() * 160 };
  }, [route]);

  const p = PALETTES[mood];
  const id = `pc-${route.id}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="postcard" preserveAspectRatio="xMidYMid slice" role="img" aria-label={`${route.name} illustration`}>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky[0]} />
          <stop offset="0.6" stopColor={p.sky[1]} />
          <stop offset="1" stopColor={p.sky[2]} />
        </linearGradient>
        <radialGradient id={`${id}-sun`}>
          <stop offset="0" stopColor={p.sun} />
          <stop offset="0.25" stopColor={p.sun} stopOpacity="0.9" />
          <stop offset="1" stopColor={p.sun} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${id}-sky)`} />
      <circle cx={art.sunX} cy={mood === "golden" ? 125 : 70} r={46} fill={`url(#${id}-sun)`} />
      <path d={toPath(art.far, { bottom: H })} fill={p.far} opacity={0.8} />
      {art.falls &&
        [0.3, 0.55, 0.72].map((f) => (
          <path
            key={f}
            d={`M${W * f} ${150} q 2 18 -1 40`}
            stroke="#f4f7fb"
            strokeWidth={2}
            opacity={0.75}
            fill="none"
            strokeLinecap="round"
          />
        ))}
      <path d={toPath(art.near, { bottom: H })} fill={p.near} />
      {art.fortAt && (
        <g transform={`translate(${art.fortAt[0]} ${art.fortAt[1]})`} fill={p.ground}>
          <rect x={-14} y={-8} width={28} height={9} />
          {[-14, -6, 2, 10].map((x) => (
            <rect key={x} x={x} y={-12} width={4} height={4} />
          ))}
        </g>
      )}
      {art.forest && (
        <path
          d={`M0 ${H - 52} ${Array.from({ length: 40 }, (_, i) => `l4 -${6 + ((i * 7) % 5)} l4 ${6 + ((i * 7) % 5)}`).join(" ")} V${H} H0 Z`}
          fill={p.ground}
          opacity={0.7}
        />
      )}
      {art.lake && <rect x={0} y={H - 46} width={W} height={18} fill={p.sky[1]} opacity={0.75} />}
      <path d={`M0 ${H - 26} Q ${W / 2} ${H - 40} ${W} ${H - 30} V${H} H0 Z`} fill={p.ground} />
      <path d={toPath(art.road)} stroke="#f6efe4" strokeOpacity={0.55} strokeWidth={5} fill="none" strokeLinecap="round" />
      <path d={toPath(art.road)} stroke={p.ground} strokeWidth={1} strokeDasharray="4 5" fill="none" />
    </svg>
  );
}
