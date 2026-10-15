import { useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { api } from "../../api/client";
import type { SunInfo, Weather } from "../../api/types";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { lerp, onScrollFrame, range, smoothstep } from "../../lib/scroll";
import { PUNE } from "../../state/store";
import { FarLayer, ForeLayer, MainLayer, MidLayer, useRange } from "./LadakhRange";
import { Wordmark } from "./Wordmark";
import "./range.css";
import "./hero.css";

const WEATHER_WORD: Record<string, string> = {
  clear: "clear skies",
  cloudy: "clouds",
  fog: "fog",
  drizzle: "drizzle",
  rain: "rain",
  heavy_rain: "heavy rain",
  thunderstorm: "thunder",
};

export function Hero({ onPlan }: { onPlan: () => void }) {
  const paths = useRange();
  const reduced = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  const far = useRef<SVGSVGElement>(null);
  const mid = useRef<SVGSVGElement>(null);
  const main = useRef<SVGSVGElement>(null);
  const fore = useRef<SVGSVGElement>(null);
  const word = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const cue = useRef<HTMLDivElement>(null);
  const sun = useRef<HTMLDivElement>(null);
  const stars = useRef<HTMLDivElement>(null);
  const [sunInfo, setSunInfo] = useState<SunInfo | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);

  useEffect(() => {
    api.sun(PUNE.lat, PUNE.lng).then(setSunInfo).catch(() => {});
    api.weather(PUNE.lat, PUNE.lng).then(setWeather).catch(() => {});
  }, []);

  useEffect(() => {
    const glyphs = Array.from(word.current!.querySelectorAll<HTMLElement>("[data-glyph]"));
    const latin = glyphs.filter((g) => g.dataset.set === "latin");
    const deva = glyphs.filter((g) => g.dataset.set === "deva");
    const move = reduced ? 0.25 : 1;

    return onScrollFrame(({ y, vh, vw }) => {
      const el = section.current;
      if (!el) return;
      const p = range(y, el.offsetTop, el.offsetTop + el.offsetHeight - vh);

      far.current!.style.transform = `translate3d(0, ${p * 40 * move}px, 0)`;
      mid.current!.style.transform = `translate3d(0, ${p * 80 * move}px, 0)`;
      main.current!.style.transform = `translate3d(0, ${p * 130 * move}px, 0)`;
      fore.current!.style.transform = `translate3d(0, ${p * 190 * move}px, 0) scale(${1 + p * 0.06})`;

      // INDIA rises out from behind the peaks, then drifts away up the page.
      const rise = smoothstep(range(p, 0, 0.6));
      const exit = range(p, 0.74, 0.96);
      // On narrow screens the central peak fills the frame, so the word starts higher.
      const start = vw < 640 ? -4 : 7;
      const wy = lerp(start, -11, rise) - exit * 14;
      word.current!.style.transform = `translate3d(-50%, calc(-50% + ${wy * move}vh), 0)`;
      word.current!.style.opacity = String(1 - exit);

      // INDIA → भारत, one glyph at a time.
      const morph = (i: number, n: number, set: "in" | "out") => {
        const t = smoothstep(range(p, 0.36 + (i / n) * 0.12, 0.5 + (i / n) * 0.12));
        return set === "out" ? 1 - t : t;
      };
      latin.forEach((g, i) => {
        const v = morph(i, latin.length, "out");
        g.style.opacity = String(v);
        g.style.filter = `blur(${(1 - v) * 14}px)`;
        g.style.transform = `translateY(${(1 - v) * -0.12}em)`;
        g.dataset.active = String(v > 0.5);
      });
      deva.forEach((g, i) => {
        const v = morph(i, deva.length, "in");
        g.style.opacity = String(v);
        g.style.filter = `blur(${(1 - v) * 14}px)`;
        g.style.transform = `translateY(${(1 - v) * 0.12}em)`;
        g.dataset.active = String(v > 0.5);
      });
      word.current!.dataset.variant = deva.some((g) => g.dataset.active === "true") ? "deva" : "latin";

      copy.current!.style.opacity = String(1 - range(p, 0, 0.18));
      copy.current!.style.transform = `translate3d(0, ${range(p, 0, 0.18) * 30}px, 0)`;
      cue.current!.style.opacity = String(1 - range(p, 0, 0.12));
      stars.current!.style.opacity = String(1 - range(p, 0.1, 0.55));
      sun.current!.style.transform = `translate3d(-50%, ${lerp(30, -8, range(p, 0.2, 1))}vh, 0)`;
      sun.current!.style.opacity = String(range(p, 0.15, 0.5));
    });
  }, [reduced]);

  const sunset = sunInfo?.sunset;
  return (
    <section ref={section} className="hero" id="top" aria-label="Weekend Throttle — India">
      <div className="hero__stage">
        <div ref={stars} className="hero__stars" aria-hidden />
        <div ref={sun} className="hero__sun" aria-hidden />
        <FarLayer ref={far} d={paths.far} />
        <MidLayer ref={mid} d={paths.mid} snow={paths.midSnow} />
        <Wordmark ref={word} />
        <MainLayer ref={main} d={paths.main} snow={paths.mainSnow} shadow={paths.mainShadow} />
        <ForeLayer ref={fore} d={paths.fore} />

        <div ref={copy} className="hero__copy">
          <p className="eyebrow hero__eyebrow">Ladakh · Sahyadri · every road between</p>
          <p className="hero__accent">
            rides that <em>listen</em>
          </p>
          <button className="hero__cta" onClick={onPlan}>
            Plan a ride
          </button>
        </div>

        <div ref={cue} className="hero__scrollcue" aria-hidden>
          <span className="eyebrow">Scroll for dawn</span>
          <i />
        </div>

        <div className="hero__live">
          {sunset && (
            <span className="chip">
              <span className="chip__dot chip__dot--sun" /> Sunset {sunset} · Pune
            </span>
          )}
          {weather && (
            <span className="chip">
              {Math.round(weather.temp_c)}° · {WEATHER_WORD[weather.condition]}
            </span>
          )}
          <button className="chip chip--icon" onClick={onPlan} aria-label="Jump to the planner">
            <ArrowDown size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
