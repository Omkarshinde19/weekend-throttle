import type { BikeType, Experience, Intent } from "../api/types";
import type { Inputs, WeatherChoice } from "./store";

/**
 * Inputs survive a reload (localStorage) and can be shared as a link (?intent=…&bike=…).
 * A shared link wins over what this browser remembered.
 */

const KEY = "wt.inputs.v1";

const INTENTS: Intent[] = ["photography", "thrill", "leisure", "food", "adventure"];
const BIKES: BikeType[] = ["cruiser", "sports", "adventure", "street", "scooter"];
const LEVELS: Experience[] = ["beginner", "intermediate", "expert"];
const WEATHER: WeatherChoice[] = ["live", "clear", "cloudy", "fog", "drizzle", "rain", "heavy_rain", "thunderstorm"];

type Raw = Record<string, unknown>;

/** Keep only values that are valid; anything else falls back to the defaults. */
export function sanitize(raw: Raw, defaults: Inputs, today: string): Inputs {
  const pick = <T>(value: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(value as T) ? (value as T) : fallback;
  const num = (value: unknown, lo: number, hi: number, fallback: number) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= lo && n <= hi ? n : fallback;
  };
  const date = typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) && raw.date >= today ? raw.date : defaults.date;

  return {
    intent: pick(raw.intent, INTENTS, defaults.intent),
    bike: pick(raw.bike, BIKES, defaults.bike),
    experience: pick(raw.experience, LEVELS, defaults.experience),
    pillion: raw.pillion === true || raw.pillion === "1" || raw.pillion === "true",
    date,
    minutes: Math.round(num(raw.minutes, 240, 1320, defaults.minutes) / 15) * 15,
    budget: num(raw.budget, 2, 10, defaults.budget),
    weather: pick(raw.weather, WEATHER, defaults.weather),
  };
}

export function loadInputs(defaults: Inputs, today: string): Inputs {
  if (typeof window === "undefined") return defaults; // tests / non-browser
  let stored: Raw = {};
  try {
    stored = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Raw;
  } catch {
    // Private mode / blocked storage: just use defaults.
  }
  const params = new URLSearchParams(window.location.search);
  const fromLink: Raw = Object.fromEntries(params.entries());
  return sanitize({ ...stored, ...fromLink }, defaults, today);
}

export function saveInputs(inputs: Inputs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(inputs));
  } catch {
    // Not fatal.
  }
}

export function shareUrl(inputs: Inputs): string {
  const params = new URLSearchParams({
    intent: inputs.intent,
    bike: inputs.bike,
    experience: inputs.experience,
    pillion: inputs.pillion ? "1" : "0",
    date: inputs.date,
    minutes: String(inputs.minutes),
    budget: String(inputs.budget),
    weather: inputs.weather,
  });
  return `${window.location.origin}${window.location.pathname}?${params}#planner`;
}
