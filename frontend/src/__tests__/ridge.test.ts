import { describe, expect, it } from "vitest";
import { noise1d, ridge, rng, shadowFaces, snowCaps, toPath } from "../lib/ridge";

const CONTROLS: [number, number][] = [
  [-60, 770],
  [300, 600],
  [800, 370],
  [1200, 600],
  [1660, 680],
];

describe("ridge generator", () => {
  it("is deterministic for a seed", () => {
    expect(ridge(CONTROLS, 0.4, 5, 7)).toEqual(ridge(CONTROLS, 0.4, 5, 7));
    expect(ridge(CONTROLS, 0.4, 5, 7)).not.toEqual(ridge(CONTROLS, 0.4, 5, 8));
  });

  it("never folds back on itself (x always increases)", () => {
    for (const seed of [1, 2, 3, 7, 41]) {
      const pts = ridge(CONTROLS, 0.5, 6, seed);
      for (let i = 1; i < pts.length; i++) expect(pts[i][0]).toBeGreaterThan(pts[i - 1][0]);
    }
  });

  it("keeps the control points and subdivides between them", () => {
    const pts = ridge(CONTROLS, 0.4, 3, 1);
    expect(pts).toHaveLength((CONTROLS.length - 1) * 2 ** 3 + 1);
    expect(pts[0]).toEqual(CONTROLS[0]);
    expect(pts[pts.length - 1]).toEqual(CONTROLS[CONTROLS.length - 1]);
  });

  it("only puts snow above the snowline region and shadows under summits", () => {
    const pts = ridge(CONTROLS, 0.4, 5, 7);
    expect(snowCaps(pts, 480, 41).length).toBeGreaterThan(0);
    expect(snowCaps(pts, 100, 41)).toHaveLength(0); // snowline above every peak
    expect(shadowFaces(pts, 900, 3).length).toBeGreaterThan(0);
  });

  it("closes filled paths at the bottom edge", () => {
    const d = toPath([[0, 10], [5, 3], [10, 8]], { bottom: 900 });
    expect(d.startsWith("M0 900")).toBe(true);
    expect(d.endsWith("L10 900 Z")).toBe(true);
  });

  it("produces smooth noise in [0, 1]", () => {
    const n = noise1d(5, 30);
    for (let x = -500; x < 500; x += 7) {
      expect(n(x)).toBeGreaterThanOrEqual(0);
      expect(n(x)).toBeLessThanOrEqual(1);
      expect(Math.abs(n(x + 1) - n(x))).toBeLessThan(0.1);
    }
    const r = rng(3);
    expect(r()).not.toEqual(r());
  });
});
