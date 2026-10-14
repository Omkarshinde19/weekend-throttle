/**
 * Procedural mountain ridges for the Ladakh skyline.
 * Deterministic (seeded) so the range looks identical on every load.
 */

export type Pt = [number, number];

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Midpoint displacement between control points → a jagged ridge line. */
export function ridge(controls: Pt[], roughness: number, depth: number, seed: number): Pt[] {
  const rand = rng(seed);
  const out: Pt[] = [controls[0]];
  const split = (a: Pt, b: Pt, d: number) => {
    if (d === 0) {
      out.push(b);
      return;
    }
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const mid: Pt = [
      (a[0] + b[0]) / 2 + (rand() - 0.5) * len * 0.08,
      (a[1] + b[1]) / 2 + (rand() - 0.5) * len * roughness,
    ];
    split(a, mid, d - 1);
    split(mid, b, d - 1);
  };
  for (let i = 1; i < controls.length; i++) split(controls[i - 1], controls[i], depth);
  return out;
}

const f = (n: number) => Math.round(n * 10) / 10;

export function toPath(points: Pt[], close?: { bottom: number }): string {
  const body = points.map(([x, y], i) => `${i ? "L" : "M"}${f(x)} ${f(y)}`).join(" ");
  if (!close) return body;
  const first = points[0];
  const last = points[points.length - 1];
  return `M${f(first[0])} ${close.bottom} L${body.slice(1)} L${f(last[0])} ${close.bottom} Z`;
}

/**
 * Snow caps: for each run of ridge points above `snowline`, a polygon from the ridge down to a
 * ragged lower edge, with occasional long gullies of snow running further down.
 */
export function snowCaps(points: Pt[], snowline: number, seed: number): string[] {
  const rand = rng(seed);
  const caps: string[] = [];
  let run: Pt[] = [];

  const flush = () => {
    if (run.length > 2) {
      const lower = run
        .slice()
        .reverse()
        .map(([x, y]): Pt => {
          const gully = rand() < 0.18 ? 25 + rand() * 70 : 0;
          const edge = snowline + (rand() - 0.3) * 26 + gully;
          return [x, Math.max(y + 3, edge)];
        });
      caps.push(toPath([...run, ...lower]) + " Z");
    }
    run = [];
  };

  for (const p of points) {
    if (p[1] < snowline) run.push(p);
    else flush();
  }
  flush();
  return caps;
}

/**
 * Shadowed faces: from every summit, the slope down to the next valley is in shadow
 * (light comes from the left / east at dawn).
 */
export function shadowFaces(points: Pt[], bottom: number, seed: number): string[] {
  const rand = rng(seed);
  const faces: string[] = [];
  const isSummit = (i: number) =>
    points[i][1] < points[i - 1][1] && points[i][1] < points[i + 1][1];

  for (let i = 2; i < points.length - 2; i++) {
    if (!isSummit(i) || points[i][1] > bottom - 120) continue;
    let j = i + 1;
    while (j < points.length - 1 && points[j + 1][1] >= points[j][1] - 4) j++;
    if (j - i < 3) continue;

    const summit = points[i];
    const spur: Pt[] = [];
    const steps = 6;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      spur.push([summit[0] + t * (rand() * 30 + 10) - 8, summit[1] + (bottom - summit[1]) * t]);
    }
    faces.push(toPath([...points.slice(i, j + 1), [points[j][0], bottom], ...spur.reverse()]) + " Z");
  }
  return faces;
}
