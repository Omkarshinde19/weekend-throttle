# Weekend Throttle — Product & Algorithm Plan

A context-aware ride recommender for riders and automotive photographers around Pune / the Western Ghats.
The "AI" is a **knowledge-based expert system**: a knowledge base of rules + facts, a forward-chaining
inference engine, weighted scoring, and an explanation facility ("why was this route picked?").

---

## 1. Feature list

### Kept from the original idea (core)
| # | Feature | Where it lives |
|---|---------|----------------|
| F1 | **Golden Hour routing** — photography intent → routes whose viewpoints face the sun at sunset/sunrise, with a computed *departure time* so you reach the viewpoint in the golden window | `engine/facts.py`, `engine/timing.py`, `rules/route_rules.json` |
| F2 | **Weather-dynamic safety** — heavy rain filters dirt/offroad, penalises landslide-prone ghats, boosts covered dhabas | `rules/context_rules.json`, `rules/route_rules.json`, `engine/pitstops.py` |
| F3 | **Pitstop curation** — chai tapris, biker cafes, dhabas, viewpoints, spaced by ride length and rider fatigue | `engine/pitstops.py` |
| F4 | **Rider profiles** — cruiser / sports / adventure / street / scooter change speed, preferred road style, break interval, fuel range | `data/bikes.json` |

### Added (things that make it feel smart and are good for the viva)
| # | Feature | Why |
|---|---------|-----|
| A1 | **Explanation panel** — every recommendation returns the exact rules that fired (+/- points, filters, warnings) | Turns if/else into an "expert system with explanation facility" |
| A2 | **What-if simulator** — UI sliders for time / weather / bike; results update live | Best demo moment: flip to Heavy Rain and watch dirt routes vanish |
| A3 | **Rider experience + pillion** — beginners get steep/broken roads filtered, pillion reduces break interval & aggressive twisties | More realistic personalisation |
| A4 | **Season awareness** — Maharashtra monsoon (Jun–Sep) boosts waterfall routes, warns on landslide zones | Local relevance |
| A5 | **Night-ride safety** — after dark, only `night_safe` routes; warnings for unlit ghats | Safety |
| A6 | **Fuel range check** — warns when the route's longest fuel gap exceeds the bike's comfortable range | Practical |
| A7 | **Ride timeline** — leave-by time, arrival at each stop, sunset marker, ETA home | Great UI component |
| A8 | **Gear advisor** — "carry rain liner", "extra layer, 16°C at the top", "lights check" | Cheap rules, high delight |
| A9 | **Engine room page** — shows the whole knowledge base (rules, weights) read-only | Lets evaluators *see* the AI |

### Phase 2 (only if time permits)
| # | Feature |
|---|---------|
| P1 | **Learning from feedback** — riders rate a ride 1–5; per-tag preference weights update (simple online learning) and feed back into scoring |
| P2 | Rule editor in the UI (toggle rules on/off, change weights) |
| P3 | Group ride mode (lowest-common-denominator bike + experience) |
| P4 | Share ride card as an image |

### Removed / changed
| Removed | Reason |
|---------|--------|
| Google Maps Platform | Needs a billing card. Use **MapLibre/Leaflet + OpenStreetMap**, routing via **OpenRouteService** |
| OpenWeatherMap | Replaced by **Open-Meteo** (no API key, gives hourly forecast) |
| User accounts / login | Not needed for the demo; keep the profile in browser localStorage |
| PostgreSQL on day one | JSON knowledge base + SQLite later is enough |

---

## 2. The algorithm

```
           ┌──────────────┐
 UI input ─► 1. Fact base  │  ctx: intent, bike, experience, pillion, time, start, weather, time budget
           │   + derived   │  computed: sunrise/sunset, sun azimuth, season, minutes to sunset, daylight
           └──────┬───────┘
                  ▼
           ┌──────────────┐
           │ 2. Forward   │  context_rules.json fire repeatedly until no new facts (fixpoint)
           │   chaining   │  e.g. precip > 7mm/h → rain_level=heavy → road_wet=true → offroad_unsafe=true
           └──────┬───────┘
                  ▼   for every route in the knowledge base
           ┌──────────────┐
           │ 3. Route     │  per-route computed facts: approach time, total time, time fit,
           │   facts      │  best viewpoint, sun alignment, arrival in golden window, fuel gap
           └──────┬───────┘
                  ▼
           ┌──────────────┐  FILTER rules → exclude (with reason)
           │ 4. Route     │  SCORE rules  → ± weight (optionally scaled by a 0–1 fact)
           │   rules      │  WARN rules   → caution chips on the card
           └──────┬───────┘
                  ▼
           ┌──────────────┐
           │ 5. Rank      │  score = clamp(50 + Σ weights, 0, 100), ties broken by time fit
           └──────┬───────┘
                  ▼
           ┌──────────────┐
           │ 6. Plan      │  departure time, pitstops (greedy spacing by break interval),
           │              │  timeline, gear advice
           └──────────────┘
```

**Knowledge base is data, not code.** Rules live in `backend/app/data/rules/*.json` using a small condition DSL:

```json
{
  "id": "R_RAIN_NO_DIRT",
  "type": "filter",
  "when": { "all": [
    { "fact": "derived.rain_level", "op": "in", "value": ["moderate", "heavy"] },
    { "fact": "route.surface", "op": "in", "value": ["dirt", "mixed"] }
  ]},
  "explain": "Wet weather — unpaved surfaces are unsafe"
}
```

Operators: `eq, ne, in, not_in, contains, gt, gte, lt, lte, between, exists`; combinators: `all, any, not`.

---

## 3. API contract (for the UI team)

Base URL: `http://localhost:8000` · interactive docs at `/docs`

| Method | Path | Use in UI |
|--------|------|-----------|
| GET | `/meta` | Dropdown options: intents, bikes, experience levels, weather conditions |
| POST | `/recommend` | Main call — fire on every control change (debounce ~150 ms) |
| GET | `/routes`, `/routes/{id}` | Explore page / route detail |
| GET | `/pitstops` | Map layer of all stops |
| GET | `/rules` | Engine room page |
| GET | `/weather?lat=&lng=&at=` | Live weather chip |
| GET | `/sun?lat=&lng=&date=` | Sunset countdown chip |

`POST /recommend` body (all fields except intent/bike optional):
```json
{
  "intent": "photography",           // photography | thrill | leisure | food | adventure
  "bike": "sports",                  // cruiser | sports | adventure | street | scooter
  "experience": "intermediate",      // beginner | intermediate | expert
  "pillion": false,
  "start": { "lat": 18.5204, "lng": 73.8567 },
  "depart_at": "2026-10-17T15:30:00+05:30",
  "time_budget_hours": 5,
  "weather": { "condition": "heavy_rain" },   // omit to fetch live from Open-Meteo
  "limit": 5
}
```

Response (shape):
```
context      → the facts the engine used (incl. derived facts, sunset time, season)
advice[]     → gear / safety tips
recommendations[] →
    route {id, name, tags, distance_km, polyline, viewpoints…}
    score (0–100), score_breakdown {safety, fit, vibe, timing}
    reasons[]  {rule_id, text, delta}
    warnings[] {rule_id, text}
    timeline   {leave_by, arrive_viewpoint, sunset, back_home, …}
    pitstops[] {name, type, eta, at_km, why}
excluded[]   → {route_id, name, reasons[]}   (show greyed out in UI — great for the demo)
trace        → every rule that fired, in order (for the engine room / debug drawer)
```

---

## 4. What's built

| Screen / feature | Status | Where |
|---|---|---|
| Hero — INDIA behind a generated Ladakh range, morphs to भारत on scroll | ✅ | `frontend/src/components/hero` |
| Dawn scroll (night → sunrise → day palette) | ✅ | `hooks/useDawn.ts` |
| Weather particles: 3 depth layers, snow settles on text/cards, rain/fog/storm/dust follow the engine | ✅ | `lib/weatherScene.ts` |
| Switchback road drawn on scroll, frost-wipe cards | ✅ | `components/story`, `components/fx/Frost.tsx` |
| Planner: controls, sun-dial time picker, MapLibre map with sun cones, ranked cards (A2 what-if) | ✅ | `components/planner` |
| Explanation panel, ride timeline (A7), pitstops, ruled-out list (A1) | ✅ | `components/planner/RideDetail.tsx` |
| Engine room — working memory, chaining trace, rule base (A9) | ✅ | `components/engine` |
| Remembered inputs + shareable ride links | ✅ | `state/persist.ts` |
| Deploy: Vercel (static site + Python function at `/api`) | ✅ config | `vercel.json`, `api/index.py` |
| Learning from ride ratings (P1), rule editor (P2), group rides (P3) | ⏳ phase 2 | — |

No API keys are required anywhere: Open-Meteo, OpenFreeMap and OSRM are free and keyless.

## 5. Data note
Route and pitstop data in `backend/app/data/` is a **hand-curated sample with approximate coordinates**.
Every entry has `"verified": false` — the team should ride/check and correct it before the final demo.
