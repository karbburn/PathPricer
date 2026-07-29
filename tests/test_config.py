"""Unit tests for core/config.py Settings configuration."""

import os
from backend.app.core.config import Settings


def test_settings_default_values():
    """Verify default setting values match spec."""
    cfg = Settings()
    assert cfg.default_greeks_n == 50000
    assert cfg.max_n_simulations == 2_000_000
    assert cfg.min_n_simulations == 1_000
    assert cfg.preview_max_n == 20_000
    assert cfg.bump_fraction_default == 0.005
    assert cfg.default_convergence_grid == [1000, 5000, 25000, 100000, 500000]


def test_settings_cors_origins_parsing(monkeypatch):
    """Verify CORS allowed origins parses comma-separated string from environment."""
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "https://app1.com, https://app2.com")
    cfg = Settings()
    assert cfg.cors_allowed_origins == ["https://app1.com", "https://app2.com"]
