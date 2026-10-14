import { create } from "zustand";
import { api, ApiError } from "../api/client";
import type {
  BikeType,
  Experience,
  Intent,
  LatLng,
  RecommendResponse,
  Route,
  WeatherCondition,
} from "../api/types";

export const PUNE: LatLng = { lat: 18.5204, lng: 73.8567 };

export type WeatherChoice = "live" | WeatherCondition;

export interface Inputs {
  intent: Intent;
  bike: BikeType;
  experience: Experience;
  pillion: boolean;
  date: string; // YYYY-MM-DD (IST)
  minutes: number; // departure, minutes after midnight
  budget: number; // hours
  weather: WeatherChoice;
}

interface State {
  inputs: Inputs;
  result: RecommendResponse | null;
  allRoutes: Route[];
  loading: boolean;
  error: string | null;
  selected: number; // index into result.recommendations
  engineOpen: boolean;
  set: <K extends keyof Inputs>(key: K, value: Inputs[K]) => void;
  select: (index: number) => void;
  openEngine: (open: boolean) => void;
  fetch: () => Promise<void>;
  loadRoutes: () => Promise<void>;
}

function istToday(offsetDays = 0): string {
  const now = new Date(Date.now() + 5.5 * 3600_000 + offsetDays * 86400_000);
  return now.toISOString().slice(0, 10);
}

/** The next Saturday (or today, if it's already the weekend). */
export function nextWeekendDate(): string {
  const day = new Date(Date.now() + 5.5 * 3600_000).getUTCDay();
  const ahead = day === 6 || day === 0 ? 0 : 6 - day;
  return istToday(ahead);
}

export function dateOptions(): { date: string; label: string }[] {
  return Array.from({ length: 8 }, (_, i) => {
    const date = istToday(i);
    const d = new Date(`${date}T00:00:00Z`);
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });
    return { date, label };
  });
}

export function toIso(date: string, minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${date}T${h}:${m}:00+05:30`;
}

export function fmtMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = String(minutes % 60).padStart(2, "0");
  const suffix = h >= 12 ? "pm" : "am";
  return `${((h + 11) % 12) + 1}:${m} ${suffix}`;
}

let controller: AbortController | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

export const useStore = create<State>((set, get) => ({
  inputs: {
    intent: "photography",
    bike: "cruiser",
    experience: "intermediate",
    pillion: false,
    date: nextWeekendDate(),
    minutes: 15 * 60 + 30,
    budget: 5,
    weather: "live",
  },
  result: null,
  allRoutes: [],
  loading: false,
  error: null,
  selected: 0,
  engineOpen: false,

  set: (key, value) => {
    set((s) => ({ inputs: { ...s.inputs, [key]: value } }));
    // Debounce so dragging a slider doesn't flood the engine.
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void get().fetch(), 160);
  },

  select: (index) => set({ selected: index }),
  openEngine: (open) => set({ engineOpen: open }),

  loadRoutes: async () => {
    try {
      set({ allRoutes: await api.routes() });
    } catch {
      // The map just won't show ruled-out routes.
    }
  },

  fetch: async () => {
    controller?.abort();
    controller = new AbortController();
    const { inputs } = get();
    set({ loading: true, error: null });
    try {
      const result = await api.recommend(
        {
          intent: inputs.intent,
          bike: inputs.bike,
          experience: inputs.experience,
          pillion: inputs.pillion,
          start: PUNE,
          depart_at: toIso(inputs.date, inputs.minutes),
          time_budget_hours: inputs.budget,
          weather: inputs.weather === "live" ? null : { condition: inputs.weather },
          limit: 6,
        },
        controller.signal,
      );
      set({ result, loading: false, selected: 0 });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      set({ loading: false, error: err instanceof ApiError ? err.message : String(err) });
    }
  },
}));

/** The weather condition the scene should show: simulated choice, or what the live forecast said. */
export function useEffectiveWeather(): WeatherCondition {
  return useStore((s) =>
    s.inputs.weather !== "live" ? s.inputs.weather : s.result?.context.ctx.weather.condition ?? "clear",
  );
}
