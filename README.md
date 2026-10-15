# Weekend Throttle — India

[![CI](https://github.com/Omkarshinde19/weekend-throttle/actions/workflows/ci.yml/badge.svg)](https://github.com/Omkarshinde19/weekend-throttle/actions/workflows/ci.yml)

Context-aware ride recommender for riders and automotive photographers around Pune and the Sahyadris.
A **rule-based expert system** (forward chaining with salience, weighted scoring and an explanation
facility) behind a FastAPI backend, with a cinematic React front end.

Full feature plan, algorithm and API contract: [docs/PLAN.md](docs/PLAN.md)

## What's in the UI

- **Hero** — INDIA set behind a generated Ladakh range; it rises as you scroll and morphs into भारत.
- **Dawn scroll** — the page moves from blue hour to sunrise to warm daylight.
- **Weather particles** — snow in three depth layers that settles on letters and cards and slides off
  when you scroll fast; in the planner it follows the engine's weather (rain, storm, fog, dust).
- **Switchback road** that draws itself down the page, and **frosted cards** your cursor wipes clear.
- **Planner** — intent, bike, rider, a sun-dial time picker and weather; a MapLibre map with route glow,
  viewpoint sun-cones and pitstop pins; every recommendation explains itself rule by rule.
- **Engine room** — working memory, the forward-chaining trace and the full rule base.
- Inputs are remembered, and the link button copies a URL that reopens the same ride setup.

## Run it locally

Backend (terminal 1):

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload
```

Frontend (terminal 2) — then open http://localhost:5173:

```bash
cd frontend
npm install
npm run dev
```

API docs: http://localhost:8000/docs

## API keys

**None needed.** Weather comes from Open-Meteo, map tiles from OpenFreeMap and road geometry from OSRM —
all free and keyless. See [.env.example](.env.example); the only optional value is a Vercel token for
deploying from the command line.

## Tests

```bash
cd backend && .venv/bin/python -m pytest -q     # rule engine, API, Vercel entry
cd frontend && npm test && npm run typecheck     # ridge generator, helpers, types
```

CI runs both on every push.

## Deploy (Vercel)

The repo deploys as one Vercel project: the React build is served as static files and the FastAPI
engine runs as a Python serverless function at `/api/*` (see [vercel.json](vercel.json) and
[api/index.py](api/index.py)).

**Option A — dashboard (no tokens):** on vercel.com choose *Add New → Project*, import
`Omkarshinde19/weekend-throttle`, keep the settings Vercel reads from `vercel.json`, and click *Deploy*.
Every push to `main` redeploys automatically.

**Option B — CLI:** put `VERCEL_TOKEN=…` in `.env` (create it at https://vercel.com/account/tokens), then

```bash
npx vercel --prod --token "$VERCEL_TOKEN"
```

## Layout

```
api/index.py            Vercel entry — mounts the engine under /api
backend/app/
  data/                 knowledge base: routes, road geometry, pitstops, bikes, rules (JSON)
  engine/               conditions DSL, forward chaining, solar maths, route facts, planner
  services/weather.py   Open-Meteo live weather or simulated
  main.py               FastAPI endpoints
frontend/src/
  components/hero       Ladakh range, wordmark, parallax
  components/fx         weather particles, frost
  components/story      how-it-thinks section, switchback road
  components/planner    controls, map, results, explanations
  components/engine     engine room
  lib/                  scroll loop, ridge generator, colour, weather scene
  state/                store, persistence and share links
```

Route and pitstop data is a hand-made sample with approximate coordinates (`"verified": false`) —
check it before the demo.
