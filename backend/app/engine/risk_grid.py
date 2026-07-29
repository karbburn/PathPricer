"""2D Risk Grid Engine.

Computes Black-Scholes option price or analytical Greeks across a 2D parameter grid
using vectorized NumPy array operations over meshgrid coordinates.
"""

from __future__ import annotations

from dataclasses import dataclass
import numpy as np

from ..core.config import DEFAULT_RISK_GRID_POINTS, MAX_RISK_GRID_POINTS, MIN_SIGMA, MIN_T
from . import black_scholes


class RiskGridError(ValueError):
    """Exception raised when risk grid parameters or ranges are invalid."""

    pass


@dataclass(frozen=True)
class RiskGridResult:
    """Dataclass holding 2D risk grid surface output and metadata.

    Attributes:
        x_values: List of coordinate values along the X-axis (length num_x).
        y_values: List of coordinate values along the Y-axis (length num_y).
        grid: 2D matrix where grid[j][i] represents the evaluated metric at (x_values[i], y_values[j]).
        metric: Evaluated metric name ('price', 'delta', 'gamma', 'vega', 'theta', 'rho').
        axis_x: Parameter mapped to X-axis ('spot', 'strike', 'volatility', 'time_to_expiry', 'rate').
        axis_y: Parameter mapped to Y-axis.
    """

    x_values: list[float]
    y_values: list[float]
    grid: list[list[float]]
    metric: str
    axis_x: str
    axis_y: str


VALID_AXES = {"spot", "strike", "volatility", "time_to_expiry", "rate"}
VALID_METRICS = {"price", "delta", "gamma", "vega", "theta", "rho"}


def compute_risk_grid(
    S0: float,
    K: float,
    T: float,
    r: float,
    q: float,
    sigma: float,
    option_type: str,
    axis_x: str,
    axis_y: str,
    x_min: float,
    x_max: float,
    num_x: int = DEFAULT_RISK_GRID_POINTS,
    y_min: float = 0.0,
    y_max: float = 0.0,
    num_y: int = DEFAULT_RISK_GRID_POINTS,
    metric: str = "price",
) -> RiskGridResult:
    """Compute 2D option price or Greek risk grid using vectorized Black-Scholes broadcasting.

    Note: All 625+ cells of the 2D surface are evaluated in a single vectorized NumPy operation.
    Closed-form Black-Scholes is used exclusively (rather than Monte Carlo) to eliminate sampling
    noise and provide instant analytical risk surface generation.

    Args:
        S0: Base spot price (> 0).
        K: Base strike price (> 0).
        T: Base time to expiration in years (> 0).
        r: Base risk-free interest rate.
        q: Base dividend yield.
        sigma: Base volatility (> 0).
        option_type: 'call' or 'put'.
        axis_x: X-axis parameter name.
        axis_y: Y-axis parameter name.
        x_min: Minimum value for X-axis.
        x_max: Maximum value for X-axis.
        num_x: Number of grid points along X-axis (default 25, max 100).
        y_min: Minimum value for Y-axis.
        y_max: Maximum value for Y-axis.
        num_y: Number of grid points along Y-axis (default 25, max 100).
        metric: Metric to evaluate ('price', 'delta', 'gamma', 'vega', 'theta', 'rho').

    Returns:
        RiskGridResult: Dataclass containing grid matrix and coordinate vectors.

    Raises:
        RiskGridError: If axis choices, ranges, or parameters are invalid.
    """
    ax_x = axis_x.lower()
    ax_y = axis_y.lower()
    met = metric.lower()

    if ax_x not in VALID_AXES:
        raise RiskGridError(f"Invalid axis_x: '{axis_x}'. Must be one of {sorted(VALID_AXES)}.")
    if ax_y not in VALID_AXES:
        raise RiskGridError(f"Invalid axis_y: '{axis_y}'. Must be one of {sorted(VALID_AXES)}.")
    if ax_x == ax_y:
        raise RiskGridError(f"axis_x and axis_y must be distinct parameters. Got '{axis_x}' for both.")
    if met not in VALID_METRICS:
        raise RiskGridError(f"Invalid metric: '{metric}'. Must be one of {sorted(VALID_METRICS)}.")

    if x_min >= x_max:
        raise RiskGridError(f"x_range min ({x_min}) must be strictly less than max ({x_max}).")
    if y_min >= y_max:
        raise RiskGridError(f"y_range min ({y_min}) must be strictly less than max ({y_max}).")

    if num_x < 2 or num_x > MAX_RISK_GRID_POINTS:
        raise RiskGridError(f"num_x ({num_x}) must be between 2 and {MAX_RISK_GRID_POINTS}.")
    if num_y < 2 or num_y > MAX_RISK_GRID_POINTS:
        raise RiskGridError(f"num_y ({num_y}) must be between 2 and {MAX_RISK_GRID_POINTS}.")

    # Validate that grid bounds produce valid positive parameters
    def _validate_axis_bounds(axis_name: str, val_min: float, val_max: float):
        if axis_name in ("spot", "strike") and val_min <= 0:
            raise RiskGridError(f"{axis_name} grid minimum ({val_min}) must be strictly positive (> 0).")
        if axis_name == "volatility" and val_min < MIN_SIGMA:
            raise RiskGridError(f"Volatility grid minimum ({val_min}) must be positive (>= {MIN_SIGMA}).")
        if axis_name == "time_to_expiry" and val_min < MIN_T:
            raise RiskGridError(f"Time to expiry grid minimum ({val_min}) must be positive (>= {MIN_T}).")

    _validate_axis_bounds(ax_x, x_min, x_max)
    _validate_axis_bounds(ax_y, y_min, y_max)

    x_vec = np.linspace(x_min, x_max, num_x)
    y_vec = np.linspace(y_min, y_max, num_y)

    # 2D Meshgrids: X has shape (num_y, num_x), Y has shape (num_y, num_x)
    X, Y = np.meshgrid(x_vec, y_vec)

    params: dict[str, float | np.ndarray] = {
        "spot": S0,
        "strike": K,
        "time_to_expiry": T,
        "rate": r,
        "volatility": sigma,
    }
    params[ax_x] = X
    params[ax_y] = Y

    # Vectorized evaluation over the full 2D meshgrid
    bs_vec_res = black_scholes.price_and_greeks_vectorized(
        S0=params["spot"],
        K=params["strike"],
        T=params["time_to_expiry"],
        r=params["rate"],
        q=q,
        sigma=params["volatility"],
        option_type=option_type,
    )

    grid_matrix = getattr(bs_vec_res, met)
    grid_list = [[float(val) for val in row] for row in grid_matrix]

    return RiskGridResult(
        x_values=[float(x) for x in x_vec],
        y_values=[float(y) for y in y_vec],
        grid=grid_list,
        metric=met,
        axis_x=ax_x,
        axis_y=ax_y,
    )
