"""FastAPI main application entrypoint.

Registers API routers under /api/v1 prefix, configures CORS,
and wires dependency injection.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import market, pricing, quantitative, report, validation
from .core.config import settings

app = FastAPI(title="PathPricer API", version="0.1.0")

# CORS — env-driven allowed origins from settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check (outside /api/v1 — used by Render and keep-alive workflow)
@app.get("/health")
def health_check() -> dict[str, str]:
    """Health check endpoint for keep-alive and monitoring."""
    return {"status": "ok"}


# Register API routers under /api/v1 prefix
app.include_router(market.router, prefix="/api/v1")
app.include_router(pricing.router, prefix="/api/v1")
app.include_router(quantitative.router, prefix="/api/v1")
app.include_router(report.router, prefix="/api/v1")
app.include_router(validation.router, prefix="/api/v1")
