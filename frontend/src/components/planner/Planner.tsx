import { lazy, Suspense } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useStore } from "../../state/store";
import { ErrorBoundary } from "../ErrorBoundary";
import { Controls } from "./Controls";
import { AdviceStrip, FeaturedRide, GoldenCard, RideStats } from "./ResultCards";
import { Excluded, Pitstops, Timeline, WhyPanel } from "./RideDetail";
import { SideRail } from "./SideRail";
import "./planner.css";

// MapLibre is ~800 kB — load it after the hero has painted.
const RideMap = lazy(() => import("./RideMap").then((m) => ({ default: m.RideMap })));

function EngineStatus() {
  const loading = useStore((s) => s.loading);
  const result = useStore((s) => s.result);
  const fired = result?.trace.context_rules.length ?? 0;
  return (
    <div className={`engine-status ${loading ? "is-busy" : ""}`} role="status">
      {loading ? <Loader2 size={14} className="spin" /> : <span className="engine-status__dot" />}
      {loading
        ? "Reasoning…"
        : result
          ? `${fired} facts derived · ${result.recommendations.length} ranked · ${result.excluded.length} ruled out`
          : "Engine idle"}
    </div>
  );
}

export function Planner() {
  const result = useStore((s) => s.result);
  const error = useStore((s) => s.error);
  const selected = useStore((s) => s.selected);
  const refetch = useStore((s) => s.fetch);
  const rec = result?.recommendations[selected];

  return (
    <section id="planner" className="planner">
      <SideRail />

      <header className="planner__head">
        <div>
          <p className="eyebrow">Photography — twisties — chai runs</p>
          <h2>
            Rides that <em>listen</em>
          </h2>
          <p className="planner__lede">
            Tell it what you ride and why. It reads the sky, reasons like a rider, and shows its work.
          </p>
        </div>
        <ul className="planner__pillars" aria-label="What the engine considers">
          <li>Weather</li>
          <li>Light</li>
          <li>Rider</li>
          <li>Road</li>
        </ul>
      </header>

      <div className="planner__grid">
        <Controls />

        <div className="planner__results">
          <div className="planner__map-wrap">
            <ErrorBoundary
              fallback={
                <div className="ride-map">
                  <div className="ride-map__fallback">The map couldn't start in this browser.</div>
                </div>
              }
            >
              <Suspense fallback={<div className="ride-map ride-map--loading" />}>
                <RideMap recs={result?.recommendations ?? []} selected={selected} />
              </Suspense>
            </ErrorBoundary>
            <EngineStatus />
          </div>

          {error && (
            <div className="planner__error glass" role="alert">
              <p>{error}</p>
              <code>cd backend &amp;&amp; .venv/bin/uvicorn app.main:app --reload</code>
              <button className="round round--dark" onClick={() => void refetch()} aria-label="Retry">
                <RefreshCw size={16} />
              </button>
            </div>
          )}

          {result && !rec && !error && (
            <div className="planner__empty glass">
              <h3>No ride fits.</h3>
              <p>Every route was ruled out — try more time, a different bike, or kinder weather.</p>
            </div>
          )}

          {result && rec && (
            <div className="planner__cards">
              <FeaturedRide result={result} rec={rec} />
              <div className="planner__stack">
                <RideStats rec={rec} />
                <GoldenCard result={result} rec={rec} />
              </div>
            </div>
          )}
        </div>
      </div>

      {result && <AdviceStrip result={result} />}

      {result && rec && (
        <div className="planner__detail">
          <WhyPanel rec={rec} />
          <Timeline rec={rec} />
        </div>
      )}
      {rec && <Pitstops rec={rec} />}
      {result && <Excluded result={result} />}
    </section>
  );
}
