// Mirrors the FastAPI backend (backend/app). Keep in sync with docs/PLAN.md §3.

export type Intent = "photography" | "thrill" | "leisure" | "food" | "adventure";
export type BikeType = "cruiser" | "sports" | "adventure" | "street" | "scooter";
export type Experience = "beginner" | "intermediate" | "expert";
export type WeatherCondition =
  | "clear"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "heavy_rain"
  | "thunderstorm";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RecommendRequest {
  intent: Intent;
  bike: BikeType;
  experience: Experience;
  pillion: boolean;
  start: LatLng;
  depart_at: string;
  time_budget_hours: number;
  weather?: { condition: WeatherCondition } | null;
  limit: number;
}

export interface Weather {
  condition: WeatherCondition;
  precip_mm: number;
  temp_c: number;
  visibility_km: number;
  wind_kmh: number;
  source: "simulated" | "open-meteo" | "fallback";
  forecast_for?: string;
}

export interface Viewpoint {
  name: string;
  at_km: number;
  lat: number;
  lng: number;
  facing_deg: number;
  kind: string;
}

export interface Place {
  name: string;
  lat: number;
  lng: number;
}

export interface Route {
  id: string;
  name: string;
  region: string;
  summary: string;
  start: Place;
  end: Place;
  distance_km: number;
  duration_min: number;
  surface: "paved" | "mixed" | "dirt";
  road_quality: number;
  curvature: number;
  difficulty: number;
  elevation_gain_m: number;
  tags: string[];
  hazards: string[];
  night_safe: boolean;
  best_seasons: string[];
  max_fuel_gap_km: number;
  viewpoints: Viewpoint[];
  geometry?: [number, number][];
  verified: boolean;
}

export interface Reason {
  rule_id: string;
  category?: "safety" | "fit" | "vibe" | "timing";
  delta?: number;
  text: string;
}

export interface Pitstop {
  id: string;
  name: string;
  type: "chai_tapri" | "dhaba" | "restaurant" | "biker_cafe" | "fuel" | "viewpoint_parking" | "mechanic";
  lat: number;
  lng: number;
  at_km: number;
  rating: number;
  covered: boolean;
  specialities: string[];
  opens: string;
  closes: string;
  role: "break" | "fuel" | "food" | "viewpoint" | "destination";
  eta: string;
  open_at_eta: boolean;
  why: string[];
}

export interface TimelineEvent {
  time: string;
  kind: "depart" | "route_start" | "pitstop" | "golden" | "route_end" | "home" | "sun";
  label: string;
  stop_id?: string;
}

export interface Timeline {
  leave_at: string;
  back_home: string;
  total_hours: number;
  events: TimelineEvent[];
  golden?: {
    viewpoint: string;
    arrive: string;
    window: [string, string];
    on_time: boolean;
    spare_min_before_leaving: number;
  };
  sun_event_during_ride?: string;
}

export interface RouteStats {
  approach_km: number;
  total_km: number;
  total_min: number;
  total_hours: number;
  ride_min: number;
  break_interval_min: number;
  time_fit: number;
  in_season: boolean;
  fuel_tight: boolean;
  ends_after_dark: boolean;
  sun_alignment: number;
  best_viewpoint: string | null;
  best_viewpoint_facing?: number;
  golden_reachable: boolean | null;
  leave_by?: string;
  [key: string]: unknown;
}

export interface Recommendation {
  rank: number;
  route: Route;
  score: number;
  match: string;
  score_breakdown: Record<"safety" | "fit" | "vibe" | "timing", number>;
  reasons: Reason[];
  warnings: Reason[];
  stats: RouteStats;
  pitstops: Pitstop[];
  timeline: Timeline;
}

export interface Advice {
  rule_id: string;
  icon: string | null;
  text: string;
}

export interface ContextTrace {
  cycle: number;
  rule_id: string;
  group: string | null;
  salience: number;
  text: string;
  effects: string[];
}

export interface Derived {
  season: string;
  sunrise: string;
  sunset: string;
  sunset_azimuth: number;
  sunrise_azimuth: number;
  minutes_to_sunset: number;
  rain_level?: string;
  photo_target?: string;
  night_mode?: boolean;
  [key: string]: unknown;
}

export interface RecommendResponse {
  context: {
    ctx: Omit<RecommendRequest, "weather" | "limit"> & { weather: Weather };
    bike: { label: string; [key: string]: unknown };
    derived: Derived;
  };
  advice: Advice[];
  recommendations: Recommendation[];
  excluded: { route_id: string; name: string; reasons: Reason[] }[];
  considered: number;
  trace: { context_rules: ContextTrace[]; route_rules: Record<string, string[]> };
}

export interface Rule {
  id: string;
  type?: "filter" | "score" | "warn";
  group?: string;
  salience?: number;
  weight?: number;
  category?: string;
  scale_by?: string;
  when: unknown;
  then?: unknown;
  explain?: string;
  text?: string;
  icon?: string;
}

export interface RulesResponse {
  context_rules: Rule[];
  route_rules: Rule[];
  advice_rules: Rule[];
}

export interface SunInfo {
  date: string;
  sunrise: string;
  sunset: string;
  sunrise_azimuth: number;
  sunset_azimuth: number;
}
