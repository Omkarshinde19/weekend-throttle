import { ReactNode, useEffect, useRef } from "react";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import "./frost.css";

const BRUSH = 46;
const REFOG_EVERY_MS = 90;
const REFOG_ALPHA = 0.035;

/** A frosted-visor texture: soft white haze plus fine ice crystals. */
function frostTexture(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const haze = g.createLinearGradient(0, 0, w, h);
  haze.addColorStop(0, "rgba(246,248,252,0.66)");
  haze.addColorStop(0.5, "rgba(236,240,248,0.5)");
  haze.addColorStop(1, "rgba(246,248,252,0.68)");
  g.fillStyle = haze;
  g.fillRect(0, 0, w, h);

  // Crystals: short branching strokes.
  g.strokeStyle = "rgba(255,255,255,0.55)";
  g.lineWidth = 0.7;
  for (let i = 0; i < (w * h) / 900; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const len = 3 + Math.random() * 9;
    const a = Math.random() * Math.PI;
    g.beginPath();
    for (let k = 0; k < 3; k++) {
      const ang = a + (k * Math.PI) / 3;
      g.moveTo(x - Math.cos(ang) * len, y - Math.sin(ang) * len);
      g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    }
    g.stroke();
  }
  // Grain.
  const img = g.getImageData(0, 0, w, h);
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = Math.max(0, img.data[i] - Math.random() * 30);
  g.putImageData(img, 0, 0);
  return c;
}

/**
 * Wrap anything in frost. Moving the pointer across it wipes a clear trail (like a glove on a
 * cold visor), which slowly fogs back over.
 */
export function Frost({ children, className = "" }: { children: ReactNode; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = host.current!;
    const cv = canvas.current!;
    const ctx = cv.getContext("2d")!;
    let texture: HTMLCanvasElement | null = null;
    let visible = false;
    let last: { x: number; y: number } | null = null;

    const paint = () => {
      const r = el.getBoundingClientRect();
      cv.width = Math.max(1, Math.round(r.width));
      cv.height = Math.max(1, Math.round(r.height));
      texture = frostTexture(cv.width, cv.height);
      ctx.drawImage(texture, 0, 0);
    };
    paint();

    const wipe = (x: number, y: number) => {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      const steps = last ? Math.ceil(Math.hypot(x - last.x, y - last.y) / 8) : 1;
      for (let i = 1; i <= steps; i++) {
        const px = last ? last.x + ((x - last.x) * i) / steps : x;
        const py = last ? last.y + ((y - last.y) * i) / steps : y;
        const g = ctx.createRadialGradient(px, py, 0, px, py, BRUSH);
        g.addColorStop(0, "rgba(0,0,0,0.9)");
        g.addColorStop(0.6, "rgba(0,0,0,0.5)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(px - BRUSH, py - BRUSH, BRUSH * 2, BRUSH * 2);
      }
      ctx.restore();
      last = { x, y };
    };

    const onMove = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      wipe(e.clientX - r.left, e.clientY - r.top);
    };
    const onLeave = () => (last = null);

    const refog = setInterval(() => {
      if (!visible || !texture || reduced) return;
      ctx.globalAlpha = REFOG_ALPHA;
      ctx.drawImage(texture, 0, 0);
      ctx.globalAlpha = 1;
    }, REFOG_EVERY_MS);

    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);
    const ro = new ResizeObserver(paint);
    ro.observe(el);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      clearInterval(refog);
      io.disconnect();
      ro.disconnect();
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [reduced]);

  return (
    <div ref={host} className={`frost ${className}`}>
      {children}
      <canvas ref={canvas} className="frost__layer" aria-hidden />
    </div>
  );
}
