import { ArrowLeft, ArrowRight, ArrowUpRight, Clock, Fuel, MapPin, Moon, Route as RouteIcon, Sunrise, Sunset } from "lucide-react";
import type { Recommendation, RecommendResponse } from "../../api/types";
import { useStore } from "../../state/store";
import { RoutePostcard } from "./RoutePostcard";
import { ScoreRing } from "./ScoreRing";

function moodFor(result: RecommendResponse): "golden" | "day" | "monsoon" | "night" {
  const d = result.context.derived;
  if (d.night_mode) return "night";
  if (d.photo_target === "sunset" || d.photo_target === "sunrise") return "golden";
  if (d.rain_level && d.rain_level !== "none") return "monsoon";
  return "day";
}

const pad = (n: number) => String(n).padStart(2, "0");

export function FeaturedRide({ result, rec }: { result: RecommendResponse; rec: Recommendation }) {
  const select = useStore((s) => s.select);
  const total = result.recommendations.length;
  const i = rec.rank - 1;

  return (
    <article className="featured glass" data-snow-surface aria-live="polite">
      <div className="featured__art">
        <span className="featured__badge eyebrow">Featured ride</span>
        <RoutePostcard key={rec.route.id} route={rec.route} mood={moodFor(result)} />
      </div>
      <div className="featured__body">
        <header>
          <h3 key={rec.route.id}>{rec.route.name}</h3>
          <span className="featured__count">
            {pad(rec.rank)} / {pad(total)}
          </span>
        </header>
        <p>{rec.route.summary}</p>
        <div className="featured__tags">
          {rec.route.tags.slice(0, 4).map((t) => (
            <span key={t}>{t.replace("_", " ")}</span>
          ))}
        </div>
        <footer>
          <div className="featured__score">
            <ScoreRing score={rec.score} size={54} />
            <div>
              <b>{rec.match}</b>
              <small>{rec.route.region}</small>
            </div>
          </div>
          <div className="featured__nav">
            <button className="round" onClick={() => select((i - 1 + total) % total)} aria-label="Previous ride">
              <ArrowLeft size={16} />
            </button>
            <button className="round round--dark" onClick={() => select((i + 1) % total)} aria-label="Next ride">
              <ArrowRight size={16} />
            </button>
          </div>
        </footer>
        <div className="featured__dots" aria-hidden>
          {result.recommendations.map((r) => (
            <i key={r.rank} className={r.rank === rec.rank ? "is-on" : ""} />
          ))}
        </div>
      </div>
    </article>
  );
}

export function RideStats({ rec }: { rec: Recommendation }) {
  const s = rec.stats;
  return (
    <div className="ride-stats glass" data-snow-surface>
      <div>
        <RouteIcon size={20} strokeWidth={1.5} />
        <b>{s.total_km} km</b>
        <small>Round trip</small>
      </div>
      <div>
        <Clock size={20} strokeWidth={1.5} />
        <b>{rec.timeline.total_hours} h</b>
        <small>
          {rec.timeline.leave_at} → {rec.timeline.back_home}
        </small>
      </div>
      <div>
        <MapPin size={20} strokeWidth={1.5} />
        <b>{rec.pitstops.length}</b>
        <small>Pitstops</small>
      </div>
      <div>
        <Fuel size={20} strokeWidth={1.5} />
        <b>{rec.route.max_fuel_gap_km} km</b>
        <small>Longest fuel gap</small>
      </div>
    </div>
  );
}

export function GoldenCard({ result, rec }: { result: RecommendResponse; rec: Recommendation }) {
  const g = rec.timeline.golden;
  const d = result.context.derived;
  const Icon = d.night_mode ? Moon : d.photo_target === "sunrise" ? Sunrise : Sunset;

  return (
    <aside className="golden-card" data-snow-surface>
      <div className="golden-card__top">
        <span className="golden-card__icon">
          <Icon size={22} strokeWidth={1.5} />
        </span>
        <button className="round round--light" onClick={() => document.getElementById("timeline")?.scrollIntoView({ behavior: "smooth", block: "center" })} aria-label="Open the full ride plan">
          <ArrowUpRight size={16} />
        </button>
      </div>
      {g ? (
        <>
          <h4>
            Golden hour at <em>{g.viewpoint}</em>
          </h4>
          <p>
            Arrive {g.arrive}, light window {g.window[0]}–{g.window[1]}.{" "}
            {g.spare_min_before_leaving > 0
              ? `Leave at ${rec.timeline.leave_at} — you've ${g.spare_min_before_leaving} min to spare.`
              : `Leave now (${rec.timeline.leave_at}).`}
          </p>
        </>
      ) : (
        <>
          <h4>
            Leave at <em>{rec.timeline.leave_at}</em>
          </h4>
          <p>
            Back by {rec.timeline.back_home}. Sunset is {d.sunset}
            {rec.stats.ends_after_dark ? " — you'll finish in the dark." : "."}
          </p>
        </>
      )}
    </aside>
  );
}

export function AdviceStrip({ result }: { result: RecommendResponse }) {
  if (!result.advice.length) return null;
  return (
    <ul className="advice">
      {result.advice.map((a) => (
        <li key={a.rule_id} title={a.rule_id}>
          {a.text}
        </li>
      ))}
    </ul>
  );
}
