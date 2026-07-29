"""Application parameters and configuration settings.

Centralized configuration for operational bounds, default grid sizes,
and numerical constants.
"""

# Numerical constants
MIN_T: float = 1e-7
MIN_SIGMA: float = 1e-7
DAYS_PER_YEAR: float = 365.0

# Simulation bounds & defaults
DEFAULT_CONVERGENCE_GRID: list[int] = [1000, 5000, 25000, 100000, 500000]
DEFAULT_GREEKS_N: int = 50000
MAX_N_SIMULATIONS: int = 2_000_000
MIN_N_SIMULATIONS: int = 1_000
PREVIEW_MAX_N: int = 20_000
BUMP_FRACTION_DEFAULT: float = 0.005
