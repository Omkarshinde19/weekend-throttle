import { useEffect, useState } from "react";
import { ArrowRight, CloudRain, Compass, Sunset } from "lucide-react";
import { api } from "../../api/client";
import { Frost } from "../fx/Frost";
import { Switchbacks } from "./Switchbacks";
import "./story.css";

interface Counts {
  routes: number;
  pitstops: number;
  rules: number;
}

const CHAIN = ["Heavy rain", "Wet road", "Dirt unsafe", "Rajmachi trail filtered"];

export function Story() {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    Promise.all([api.rules(), api.routes(), api.pitstops()])
      .then(([rules, routes, stops]) =>
        setCounts({
          rules: rules.context_rules.length + rules.route_rules.length + rules.advice_rules.length,
          routes: routes.length,
          pitstops: stops.length,
        }),
      )
      .catch(() => {});
  }, []);

  return (
    <section id="story" className="story">
      <Switchbacks />

      <header className="story__head">
        <p className="eyebrow">How it thinks</p>
        <h2>
          Maps get you there fast.
          <br />
          <em>We get you there right.</em>
        </h2>
        <p className="story__hint">Wipe the frost off the cards ↓</p>
      </header>

      <ol className="story__steps">
        <li className="story__step story__step--left">
          <Frost className="story__card">
            <div data-snow-surface className="story__card-inner">
              <span className="story__num">01</span>
              <h3>Read the sky</h3>
              <p>
                Live forecast, the exact minute of sunset and which way the sun sets. Monsoon in the Sahyadris is
                a different country from October.
              </p>
              <div className="story__chips">
                <span>
                  <CloudRain size={14} /> 4 mm/h
                </span>
                <span>
                  <Sunset size={14} /> 18:12
                </span>
                <span>
                  <Compass size={14} /> 260° west
                </span>
              </div>
            </div>
          </Frost>
        </li>

        <li className="story__step story__step--right">
          <Frost className="story__card">
            <div data-snow-surface className="story__card-inner">
              <span className="story__num">02</span>
              <h3>Reason like a rider</h3>
              <p>
                Rules fire one after another, highest priority first, until nothing new can be learned. That's
                forward chaining, the same idea behind classic expert systems.
              </p>
              <div className="story__chain">
                {CHAIN.map((c, i) => (
                  <span key={c}>
                    {c}
                    {i < CHAIN.length - 1 && <ArrowRight size={12} />}
                  </span>
                ))}
              </div>
            </div>
          </Frost>
        </li>

        <li className="story__step story__step--left">
          <Frost className="story__card">
            <div data-snow-surface className="story__card-inner">
              <span className="story__num">03</span>
              <h3>Plan the ride</h3>
              <p>
                A leave-by time that puts you at the viewpoint in golden light, chai stops spaced to how tired you'll
                be, and a written reason for every pick and every route it rules out.
              </p>
            </div>
          </Frost>
        </li>
      </ol>

      <dl className="story__stats" data-snow-surface>
        <div>
          <dt>{counts?.routes ?? "16"}</dt>
          <dd>Curated routes</dd>
        </div>
        <div>
          <dt>{counts?.rules ?? "84"}</dt>
          <dd>Rules in the engine</dd>
        </div>
        <div>
          <dt>{counts?.pitstops ?? "42"}</dt>
          <dd>Chai stops &amp; dhabas</dd>
        </div>
        <div>
          <dt>5</dt>
          <dd>Rider profiles</dd>
        </div>
      </dl>
    </section>
  );
}
