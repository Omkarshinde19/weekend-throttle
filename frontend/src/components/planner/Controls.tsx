import {
  Camera,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudRainWind,
  Coffee,
  Mountain,
  Radio,
  Spline,
  Sun,
  Users,
  Waves,
} from "lucide-react";
import type { BikeType, Experience, Intent } from "../../api/types";
import { dateOptions, useStore, WeatherChoice } from "../../state/store";
import { BikeIcon } from "./BikeIcon";
import { SunDial } from "./SunDial";

const INTENTS: { id: Intent; label: string; hint: string; Icon: typeof Camera }[] = [
  { id: "photography", label: "Photography", hint: "Golden hour", Icon: Camera },
  { id: "thrill", label: "Twisties", hint: "Corners", Icon: Spline },
  { id: "leisure", label: "Chill", hint: "Lakes, easy", Icon: Waves },
  { id: "food", label: "Food run", hint: "Chai, misal", Icon: Coffee },
  { id: "adventure", label: "Adventure", hint: "Dirt, remote", Icon: Mountain },
];

const BIKES: { id: BikeType; label: string }[] = [
  { id: "cruiser", label: "Cruiser" },
  { id: "sports", label: "Sports" },
  { id: "adventure", label: "ADV" },
  { id: "street", label: "Street" },
  { id: "scooter", label: "Scooter" },
];

const LEVELS: Experience[] = ["beginner", "intermediate", "expert"];

const WEATHER: { id: WeatherChoice; label: string; Icon: typeof Sun }[] = [
  { id: "live", label: "Live", Icon: Radio },
  { id: "clear", label: "Clear", Icon: Sun },
  { id: "cloudy", label: "Cloudy", Icon: Cloud },
  { id: "fog", label: "Fog", Icon: CloudFog },
  { id: "drizzle", label: "Drizzle", Icon: CloudDrizzle },
  { id: "rain", label: "Rain", Icon: CloudRain },
  { id: "heavy_rain", label: "Downpour", Icon: CloudRainWind },
  { id: "thunderstorm", label: "Storm", Icon: CloudLightning },
];

export function Controls() {
  const inputs = useStore((s) => s.inputs);
  const set = useStore((s) => s.set);
  const derived = useStore((s) => s.result?.context.derived);
  const liveWeather = useStore((s) => s.result?.context.ctx.weather);

  return (
    <div className="controls glass" data-snow-surface>
      <fieldset className="field">
        <legend className="eyebrow">I want to</legend>
        <div className="intents">
          {INTENTS.map(({ id, label, hint, Icon }) => (
            <button
              key={id}
              className={`intent ${inputs.intent === id ? "is-on" : ""}`}
              onClick={() => set("intent", id)}
              aria-pressed={inputs.intent === id}
            >
              <Icon size={18} strokeWidth={1.6} />
              <b>{label}</b>
              <small>{hint}</small>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend className="eyebrow">On my</legend>
        <div className="bikes">
          {BIKES.map(({ id, label }) => (
            <button
              key={id}
              className={`bike ${inputs.bike === id ? "is-on" : ""}`}
              onClick={() => set("bike", id)}
              aria-pressed={inputs.bike === id}
            >
              <BikeIcon bike={id} size={46} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="field field--row">
        <div className="segmented" role="radiogroup" aria-label="Experience">
          {LEVELS.map((lvl) => (
            <button
              key={lvl}
              role="radio"
              aria-checked={inputs.experience === lvl}
              className={inputs.experience === lvl ? "is-on" : ""}
              onClick={() => set("experience", lvl)}
            >
              {lvl}
            </button>
          ))}
        </div>
        <button
          className={`toggle ${inputs.pillion ? "is-on" : ""}`}
          role="switch"
          aria-checked={inputs.pillion}
          onClick={() => set("pillion", !inputs.pillion)}
        >
          <Users size={15} /> Pillion
          <i />
        </button>
      </div>

      <fieldset className="field">
        <legend className="eyebrow">Leaving</legend>
        <div className="dates">
          {dateOptions().map((d) => (
            <button key={d.date} className={inputs.date === d.date ? "is-on" : ""} onClick={() => set("date", d.date)}>
              {d.label}
            </button>
          ))}
        </div>
        <SunDial
          minutes={inputs.minutes}
          onChange={(m) => set("minutes", m)}
          sunrise={derived?.sunrise}
          sunset={derived?.sunset}
        />
      </fieldset>

      <fieldset className="field">
        <legend className="eyebrow">
          Time I have <output>{inputs.budget} h</output>
        </legend>
        <input
          className="slider"
          type="range"
          min={2}
          max={10}
          step={0.5}
          value={inputs.budget}
          onChange={(e) => set("budget", Number(e.target.value))}
          style={{ ["--fill" as string]: `${((inputs.budget - 2) / 8) * 100}%` }}
          aria-label="Time budget in hours"
        />
      </fieldset>

      <fieldset className="field">
        <legend className="eyebrow">
          Weather{" "}
          {inputs.weather === "live" && liveWeather && (
            <output>
              live: {liveWeather.condition.replace("_", " ")}, {Math.round(liveWeather.temp_c)}°
            </output>
          )}
        </legend>
        <div className="weather">
          {WEATHER.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={inputs.weather === id ? "is-on" : ""}
              onClick={() => set("weather", id)}
              aria-pressed={inputs.weather === id}
              title={id === "live" ? "Use the live forecast" : `Simulate ${label.toLowerCase()}`}
            >
              <Icon size={16} strokeWidth={1.7} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
