"""Vercel serverless entry point.

Vercel serves the built React app as static files and routes every /api/* request here
(see vercel.json). The FastAPI backend is mounted under /api so the frontend can call
/api/recommend on the same domain, exactly like the Vite dev proxy does locally.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from fastapi import FastAPI  # noqa: E402

from app.main import app as engine  # noqa: E402

app = FastAPI(title="Weekend Throttle", docs_url=None, redoc_url=None)
app.mount("/api", engine)
