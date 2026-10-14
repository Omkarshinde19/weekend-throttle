/**
 * One requestAnimationFrame loop for everything scroll-driven (parallax, dawn colours, snow).
 * Subscribers get the scroll position and a smoothed velocity in px/frame.
 */

export interface ScrollState {
  y: number;
  velocity: number;
  vh: number;
  vw: number;
}

type Listener = (s: ScrollState) => void;

const listeners = new Set<Listener>();
const state: ScrollState = { y: 0, velocity: 0, vh: 0, vw: 0 };
let running = false;
let lastY = 0;

function tick() {
  const y = window.scrollY;
  state.velocity = state.velocity * 0.8 + (y - lastY) * 0.2;
  state.y = y;
  state.vh = window.innerHeight;
  state.vw = window.innerWidth;
  lastY = y;
  listeners.forEach((fn) => fn(state));
  if (listeners.size) requestAnimationFrame(tick);
  else running = false;
}

export function onScrollFrame(fn: Listener): () => void {
  listeners.add(fn);
  if (!running) {
    running = true;
    lastY = window.scrollY;
    requestAnimationFrame(tick);
  }
  return () => listeners.delete(fn);
}

export function getScroll(): ScrollState {
  return state;
}

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** Map v from [a, b] to [0, 1], clamped. */
export const range = (v: number, a: number, b: number) => clamp((v - a) / (b - a));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const smoothstep = (t: number) => t * t * (3 - 2 * t);
