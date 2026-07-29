"""Application parameters and configuration settings.

Centralized configuration for operational bounds, default grid sizes,
CORS origins, and numerical constants.
"""

from __future__ import annotations

import json
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralized application settings loaded from environment or .env file."""

    cors_allowed_origins: list[str] | str = ["http://localhost:3000", "https://pathpricer.vercel.app", "https://pathpricer-backend.onrender.com"]
    default_convergence_grid: list[int] = [1000, 5000, 25000, 100000, 500000]
    default_greeks_n: int = 50000
    max_n_simulations: int = 2_000_000
    min_n_simulations: int = 1_000
    preview_max_n: int = 20_000
    bump_fraction_default: float = 0.005
    min_t: float = 1e-7
    min_sigma: float = 1e-7
    days_per_year: float = 365.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("cors_allowed_origins", mode="after")
    @classmethod
    def ensure_list_of_strings(cls, v: list[str] | str) -> list[str]:
        """Ensure CORS origins is converted to a list of clean origin strings."""
        if isinstance(v, str):
            if v.startswith("["):
                try:
                    parsed = json.loads(v)
                    if isinstance(parsed, list):
                        return [str(x).strip() for x in parsed]
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v


settings = Settings()

# Module-level aliases for backwards compatibility with engine/ imports
MIN_T: float = settings.min_t
MIN_SIGMA: float = settings.min_sigma
DAYS_PER_YEAR: float = settings.days_per_year
DEFAULT_CONVERGENCE_GRID: list[int] = settings.default_convergence_grid
DEFAULT_GREEKS_N: int = settings.default_greeks_n
MAX_N_SIMULATIONS: int = settings.max_n_simulations
MIN_N_SIMULATIONS: int = settings.min_n_simulations
PREVIEW_MAX_N: int = settings.preview_max_n
BUMP_FRACTION_DEFAULT: float = settings.bump_fraction_default
