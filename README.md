# Weekend Throttle

Context-aware ride recommender for riders and automotive photographers around Pune.
A rule-based expert system (forward chaining + weighted scoring + explanations) behind a FastAPI backend.

Full feature plan, algorithm and API contract: [docs/PLAN.md](docs/PLAN.md)

## Run the backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload
```

Open http://localhost:8000/docs to try every endpoint in the browser.

## Run the tests

```bash
cd backend && .venv/bin/python -m pytest -q
```

## Layout

```
backend/app/
  data/                  ← knowledge base (edit these, not the code, to tune behaviour)
    routes.json            16 routes with tags, hazards, viewpoints (facing direction)
    pitstops.json          chai tapris, dhabas, biker cafes, fuel, viewpoints
    bikes.json             rider profiles (pace, break interval, range, likes/dislikes)
    rules/context_rules.json   forward-chained rules → derived facts (rain level, night mode…)
    rules/route_rules.json     filter / score / warn rules per route
    rules/advice_rules.json    gear & safety tips
  engine/
    conditions.py   rule condition language (all/any/not, eq/in/gt/between…)
    inference.py    forward chaining (salience + refraction) and route rule evaluation
    facts.py        builds working memory from the request (season, sunset, …)
    solar.py        sunrise/sunset time and sun direction
    route_facts.py  per-route computed facts: travel time, sun alignment, time fit
    planner.py      pitstop selection and the ride timeline
    recommender.py  the full pipeline
  services/weather.py   Open-Meteo (live) or simulated weather
  main.py               FastAPI endpoints
```

Route/pitstop data is a hand-made sample with approximate coordinates (`"verified": false`) — check it before the demo.
