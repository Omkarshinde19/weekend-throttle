import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { api } from "../../api/client";
import type { Rule, RulesResponse } from "../../api/types";
import { describe, describeThen } from "../../lib/describeRule";
import { useStore } from "../../state/store";
import "./engine.css";

type Tab = "context_rules" | "route_rules" | "advice_rules";

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "context_rules", label: "Context", hint: "Forward-chained: derive new facts" },
  { id: "route_rules", label: "Route", hint: "Filter · score · warn per route" },
  { id: "advice_rules", label: "Advice", hint: "Gear and safety tips" },
];

const HIDDEN_FACTS = new Set(["sunrise_azimuth", "minutes_to_sunrise", "hour"]);

function fmt(v: unknown): string {
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
}

/** The AI, opened up: working memory, the chaining trace, and the whole rule base. */
export function EngineRoom() {
  const open = useStore((s) => s.engineOpen);
  const close = useStore((s) => s.openEngine);
  const result = useStore((s) => s.result);
  const selected = useStore((s) => s.selected);
  const [rules, setRules] = useState<RulesResponse | null>(null);
  const [tab, setTab] = useState<Tab>("context_rules");

  useEffect(() => {
    if (open && !rules) api.rules().then(setRules).catch(() => {});
  }, [open, rules]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close]);

  const rec = result?.recommendations[selected];
  const fired = useMemo(() => {
    const ids = new Set<string>();
    result?.trace.context_rules.forEach((t) => ids.add(t.rule_id));
    if (rec) result?.trace.route_rules[rec.route.id]?.forEach((id) => ids.add(id));
    result?.advice.forEach((a) => ids.add(a.rule_id));
    return ids;
  }, [result, rec]);

  if (!open) return null;

  const list: Rule[] = rules?.[tab] ?? [];
  const derived = Object.entries(result?.context.derived ?? {}).filter(([k]) => !HIDDEN_FACTS.has(k));

  return (
    <div className="engine" role="dialog" aria-modal="true" aria-label="Engine room">
      <div className="engine__backdrop" onClick={() => close(false)} />
      <div className="engine__panel">
        <header className="engine__head">
          <div>
            <p className="eyebrow">Engine room</p>
            <h2>
              The rules, <em>thinking out loud</em>
            </h2>
            {rec && (
              <p className="engine__sub">
                Explaining <b>{rec.route.name}</b> · {fired.size} rules fired for this ride
              </p>
            )}
          </div>
          <button className="engine__close" onClick={() => close(false)} aria-label="Close engine room">
            <X size={18} />
          </button>
        </header>

        <div className="engine__grid">
          <section className="engine__card">
            <h3>Working memory</h3>
            <p className="engine__note">Facts the engine knew or derived for this request.</p>
            <dl className="engine__facts">
              {derived.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{fmt(v)}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="engine__card">
            <h3>Forward chaining</h3>
            <p className="engine__note">Each cycle fires the highest-salience rule that matches, until nothing new can be learned.</p>
            <ol className="engine__chain">
              {result?.trace.context_rules.map((t, i) => (
                <li key={t.rule_id} style={{ animationDelay: `${i * 70}ms` }}>
                  <span className="engine__cycle">{t.cycle}</span>
                  <div>
                    <code>
                      {t.rule_id} <small>salience {t.salience}</small>
                    </code>
                    <p>{t.text}</p>
                    {t.effects.map((e) => (
                      <span key={e} className="engine__effect">
                        {e}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="engine__card engine__card--wide">
            <div className="engine__tabs" role="tablist">
              {TABS.map((t) => (
                <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "is-on" : ""} onClick={() => setTab(t.id)}>
                  {t.label} <small>{rules?.[t.id].length ?? ""}</small>
                </button>
              ))}
              <span className="engine__tabhint">{TABS.find((t) => t.id === tab)?.hint}</span>
            </div>
            <ul className="engine__rules">
              {list.map((r) => (
                <li key={r.id} className={fired.has(r.id) ? "is-fired" : ""}>
                  <header>
                    <code>{r.id}</code>
                    {r.type && <span className={`engine__type t-${r.type}`}>{r.type}</span>}
                    {typeof r.weight === "number" && (
                      <span className="engine__weight">
                        {r.weight > 0 ? "+" : ""}
                        {r.weight}
                        {r.scale_by ? ` × ${r.scale_by.split(".").pop()}` : ""}
                      </span>
                    )}
                    {typeof r.salience === "number" && <span className="engine__weight">salience {r.salience}</span>}
                    {fired.has(r.id) && <span className="engine__fired">fired</span>}
                  </header>
                  <p className="engine__if">
                    <b>IF</b> {describe(r.when)}
                  </p>
                  {r.then != null && (
                    <p className="engine__then">
                      <b>THEN</b> {describeThen(r.then)}
                    </p>
                  )}
                  <p className="engine__explain">{r.explain ?? r.text}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
