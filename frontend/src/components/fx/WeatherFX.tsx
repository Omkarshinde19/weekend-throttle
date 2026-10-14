import { useEffect, useRef, useState } from "react";
import type { WeatherCondition } from "../../api/types";
import { prefersReducedMotion } from "../../hooks/useReducedMotion";
import { onScrollFrame } from "../../lib/scroll";
import { FxMode, WeatherScene } from "../../lib/weatherScene";
import { useEffectiveWeather } from "../../state/store";
import "./weatherFx.css";

const MODE: Record<WeatherCondition, [FxMode, number]> = {
  clear: ["dust", 1],
  cloudy: ["snow", 0.6],
  fog: ["fog", 1],
  drizzle: ["rain", 0.45],
  rain: ["rain", 1],
  heavy_rain: ["storm", 0.85],
  thunderstorm: ["storm", 1],
};

/**
 * Full-screen particle layers. Snow everywhere, except while the planner is on screen —
 * then the scene shows whatever weather the rule engine is reasoning about.
 */
export function WeatherFX({ plannerId }: { plannerId: string }) {
  const backRef = useRef<HTMLCanvasElement>(null);
  const frontRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<WeatherScene | null>(null);
  const [plannerVisible, setPlannerVisible] = useState(false);
  const weather = useEffectiveWeather();

  useEffect(() => {
    const scene = new WeatherScene(backRef.current!, frontRef.current!, prefersReducedMotion());
    sceneRef.current = scene;
    scene.refreshSurfaces();

    let last = performance.now();
    const stop = onScrollFrame(({ velocity }) => {
      const now = performance.now();
      if (!document.hidden) scene.frame(now - last, velocity);
      last = now;
    });
    const poll = setInterval(() => scene.refreshSurfaces(), 600);
    const onResize = () => scene.resize();
    window.addEventListener("resize", onResize);
    document.fonts?.ready.then(() => scene.resize());
    return () => {
      stop();
      clearInterval(poll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    const el = document.getElementById(plannerId);
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setPlannerVisible(entry.isIntersecting), {
      threshold: 0.25,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [plannerId]);

  useEffect(() => {
    const [mode, intensity] = plannerVisible ? MODE[weather] : (["snow", 1] as const);
    sceneRef.current?.setMode(mode, intensity);
  }, [plannerVisible, weather]);

  return (
    <>
      <canvas ref={backRef} className="fx fx--back" aria-hidden />
      <canvas ref={frontRef} className="fx fx--front" aria-hidden />
    </>
  );
}
