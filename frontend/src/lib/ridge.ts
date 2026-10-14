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
    // Displace by horizontal span only, so steep faces don't fold back on themselves.
    const dx = b[0] - a[0];
    const mid: Pt = [
      (a[0] + b[0]) / 2 + (rand() - 0.5) * dx * 0.2,
      (a[1] + b[1]) / 2 + (rand() - 0.5) * dx * roughness,
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

/** Smooth 1-D value noise in [0, 1]: random values every `scale` px, cosine-interpolated. */
export function noise1d(seed: number, scale: number) {
  const rand = rng(seed);
  const values = Array.from({ length: 512 }, rand);
  return (x: number) => {
    const t = x / scale + 256;
    const i = Math.floor(t);
    const f = (1 - Math.cos((t - i) * Math.PI)) / 2;
    return values[i & 511] * (1 - f) + values[(i + 1) & 511] * f;
  };
}

/**
 * Snow caps: for each run of ridge points above `snowline`, a polygon from the ridge down to a
 * smooth, ragged lower edge, with a few long gullies of snow running further down the face.
 */
export function snowCaps(points: Pt[], snowline: number, seed: number): string[] {
  const edgeNoise = noise1d(seed, 38);
  const gullyNoise = noise1d(seed + 1, 24);
  const caps: string[] = [];
  let run: Pt[] = [];

  const lowerEdge = (x: number, y: number) => {
    const gully = Math.max(0, gullyNoise(x) - 0.68) / 0.32;
    const edge = snowline + (edgeNoise(x) - 0.4) * 40 + gully * gully * 55;
    return Math.max(y + 3, edge);
  };

  const flush = () => {
    if (run.length > 2) {
      const lower = run
        .slice()
        .reverse()
        .map(([x, y]): Pt => [x, lowerEdge(x, y)]);
      caps.push(toPath([...run, ...lower]) + " Z");
    }
    run = [];
  };

  for (const p of points) {
    if (p[1] < snowline + (edgeNoise(p[0]) - 0.4) * 46) run.push(p);
    else flush();
  }
  flush();
  return caps;
}

/**
 * Shadowed faces: from each prominent summit, the slope down to the next valley is in shadow
 * (light comes from the left / east at dawn). Small crags are ignored so faces stay broad.
 */
export function shadowFaces(points: Pt[], bottom: number, seed: number, window = 24): string[] {
  const wobble = noise1d(seed, 60);
  const faces: string[] = [];
  const isSummit = (i: number) => {
    for (let k = Math.max(0, i - window); k <= Math.min(points.length - 1, i + window); k++) {
      if (points[k][1] < points[i][1]) return false;
    }
    return true;
  };

  for (let i = 1; i < points.length - 1; i++) {
    if (!isSummit(i) || points[i][1] > bottom - 160) continue;
    let j = i + 1;
    let lowest = j;
    while (j < points.length - 1 && points[j][1] < bottom - 20 && j - i < window * 3) {
      if (points[j][1] > points[lowest][1]) lowest = j;
      j++;
      if (points[j][1] < points[lowest][1] - 50) break; // climbing back up towards another summit
    }
    if (lowest - i < 6) continue;

    const summit = points[i];
    const spur: Pt[] = [];
    for (let s = 1; s <= 10; s++) {
      const t = s / 10;
      const y = summit[1] + (bottom - summit[1]) * t;
      spur.push([summit[0] + t * 40 + (wobble(y) - 0.5) * 30 * t, y]);
    }
    faces.push(toPath([...points.slice(i, lowest + 1), [points[lowest][0], bottom], ...spur.reverse()]) + " Z");
  }
  return faces;
}
