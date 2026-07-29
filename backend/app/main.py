"""FastAPI main application entrypoint."""

from fastapi import FastAPI

app = FastAPI(title="PathPricer API", version="0.1.0")


@app.get("/health")
def health_check() -> dict[str, str]:
    """Health check endpoint for keep-alive and monitoring."""
    return {"status": "ok"}
