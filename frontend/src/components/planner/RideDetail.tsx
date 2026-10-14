import { AlertTriangle, Ban, Check, Minus, Plus } from "lucide-react";
import type { Recommendation, RecommendResponse, TimelineEvent } from "../../api/types";

const CATEGORY_LABEL = { safety: "Safety", fit: "Fit", vibe: "Vibe", timing: "Timing" } as const;

/** "Why this route?" — every rule that moved the score, as a signed bar. */
export function WhyPanel({ rec }: { rec: Recommendation }) {
  const max = Math.max(10, ...rec.reasons.map((r) => Math.abs(r.delta ?? 0)));
  return (
    <section className="why glass" id="why" data-snow-surface>
      <header>
        <p className="eyebrow">Why this route</p>
        <div className="why__cats">
          {(Object.keys(CATEGORY_LABEL) as (keyof typeof CATEGORY_LABEL)[]).map((k) => (
            <span key={k} className={rec.score_breakdown[k] < 0 ? "neg" : ""}>
              {CATEGORY_LABEL[k]} <b>{rec.score_breakdown[k] > 0 ? "+" : ""}{rec.score_breakdown[k]}</b>
            </span>
          ))}
        </div>
      </header>
      <ul className="why__list">
        {rec.reasons.map((r) => {
          const d = r.delta ?? 0;
          return (
            <li key={r.rule_id} className={d < 0 ? "neg" : "pos"}>
              <span className="why__icon">{d < 0 ? <Minus size={12} /> : <Plus size={12} />}</span>
              <span className="why__text">
                {r.text}
                <code>{r.rule_id}</code>
              </span>
              <span className="why__bar">
                <i style={{ width: `${(Math.abs(d) / max) * 100}%` }} />
              </span>
              <b>
                {d > 0 ? "+" : ""}
                {d}
              </b>
            </li>
          );
        })}
      </ul>
      {rec.warnings.length > 0 && (
        <ul className="why__warnings">
          {rec.warnings.map((w) => (
            <li key={w.rule_id}>
              <AlertTriangle size={14} /> {w.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const EVENT_CLASS: Record<TimelineEvent["kind"], string> = {
  depart: "ev--home",
  route_start: "ev--road",
  pitstop: "ev--stop",
  golden: "ev--golden",
  route_end: "ev--road",
  home: "ev--home",
  sun: "ev--sun",
};

export function Timeline({ rec }: { rec: Recommendation }) {
  return (
    <section className="timeline glass" id="timeline" data-snow-surface>
      <p className="eyebrow">Ride timeline</p>
      <ol>
        {rec.timeline.events.map((e, i) => (
          <li key={`${e.time}-${i}`} className={EVENT_CLASS[e.kind]}>
            <time>{e.time}</time>
            <i />
            <span>{e.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

const ROLE_LABEL = { break: "Break", fuel: "Fuel", food: "Food", viewpoint: "Viewpoint", destination: "Destination treat" };

export function Pitstops({ rec }: { rec: Recommendation }) {
  if (!rec.pitstops.length) return null;
  return (
    <section className="pitstops" id="pitstops">
      <p className="eyebrow">Pitstops, curated</p>
      <div className="pitstops__grid">
        {rec.pitstops.map((p) => (
          <article key={p.id} className="pitstop glass" data-snow-surface>
            <header>
              <span className={`pitstop__role role--${p.role}`}>{ROLE_LABEL[p.role]}</span>
              <time>{p.eta}</time>
            </header>
            <h5>{p.name}</h5>
            <p className="pitstop__meta">
              {p.rating}★ · km {p.at_km} · {p.covered ? "covered" : "open-air"}
              {!p.open_at_eta && <em> · may be closed</em>}
            </p>
            <ul>
              {p.why.slice(1, 4).map((w) => (
                <li key={w}>
                  <Check size={12} /> {w}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

export function Excluded({ result }: { result: RecommendResponse }) {
  if (!result.excluded.length) return null;
  return (
    <section className="excluded" id="excluded">
      <p className="eyebrow">
        Ruled out · {result.excluded.length} of {result.considered}
      </p>
      <ul>
        {result.excluded.map((e) => (
          <li key={e.route_id}>
            <Ban size={14} />
            <s>{e.name}</s>
            <span>{e.reasons.map((r) => r.text).join(" · ")}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
