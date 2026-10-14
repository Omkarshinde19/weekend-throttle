import { useEffect } from "react";
import { sample } from "../lib/color";
import { onScrollFrame, range } from "../lib/scroll";

// Ladakh blue hour → pre-dawn violet → sunrise → warm stone daylight.
const TOP: [number, string][] = [
  [0, "#070b1d"],
  [0.35, "#141c44"],
  [0.6, "#4a5a92"],
  [0.82, "#c9cfdc"],
  [1, "#efe9e1"],
];
const MID: [number, string][] = [
  [0, "#101a3a"],
  [0.35, "#3b3f74"],
  [0.6, "#d98c8c"],
  [0.82, "#f1dcc6"],
  [1, "#f2ece4"],
];
const LOW: [number, string][] = [
  [0, "#23305e"],
  [0.35, "#8a6f8f"],
  [0.6, "#f2b38b"],
  [0.82, "#f5e6d3"],
  [1, "#f5f0e9"],
];

/**
 * Drives the page's time of day from scroll position. Dawn is complete when the element with
 * id `dawnEndId` reaches the top third of the viewport.
 */
export function useDawn(dawnEndId: string) {
  useEffect(() => {
    const root = document.documentElement;
    let last = -1;
    return onScrollFrame(({ y, vh }) => {
      const end = document.getElementById(dawnEndId);
      const endY = end ? end.offsetTop - vh * 0.35 : vh * 3;
      const t = Math.round(range(y, 0, Math.max(1, endY)) * 400) / 400;
      if (t === last) return;
      last = t;
      root.style.setProperty("--dawn", String(t));
      root.style.setProperty("--sky-top", sample(TOP, t));
      root.style.setProperty("--sky-mid", sample(MID, t));
      root.style.setProperty("--sky-low", sample(LOW, t));
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", sample(TOP, t));
    });
  }, [dawnEndId]);
}
