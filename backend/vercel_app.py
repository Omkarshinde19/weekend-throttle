"""Vercel entry point for the backend service (see vercel.json → services.backend).

Vercel routes every /api/* request to this service and passes the original path
(/api/recommend, not /recommend), so the engine is mounted under /api — the same paths
the frontend uses with the Vite dev proxy locally.
"""

from fastapi import FastAPI

from app.main import app as engine

app = FastAPI(title="Weekend Throttle", docs_url=None, redoc_url=None)
app.mount("/api", engine)
