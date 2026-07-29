"""Monte Carlo option pricing simulation engine.

Implements exact GBM path sampling, standard Monte Carlo estimation,
antithetic variates, control variates, combined antithetic+CV, and confidence interval calculations.
"""

import math
import time
from dataclasses import dataclass
import numpy as np

from ..core.config import MIN_SIGMA, MIN_T


@dataclass
class MCEstimatorResult:
    """Dataclass storing Monte Carlo estimator result and performance metrics.

    Attributes:
        method: Estimator name ('standard', 'antithetic', 'control_variate', 'antithetic_cv').
        price: Estimated option price.
        standard_error: Sample standard error of the estimator.
        ci_lower: Lower bound of 95% confidence interval.
        ci_upper: Upper bound of 95% confidence interval.
        runtime_ms: Execution time in milliseconds.
        n_effective: Total number of underlying random draws/paths generated.
        paths_per_second: Computational throughput (paths / sec).
    """

    method: str
    price: float
    standard_error: float
    ci_lower: float
    ci_upper: float
    runtime_ms: float
    n_effective: int
    paths_per_second: float


def estimate_standard(
    S0: float,
    K: float,
    T: float,
    r: float,
    q: float,
    sigma: float,
    option_type: str,
    n_simulations: int,
    rng: np.random.Generator,
    base_Z: np.ndarray | None = None,
) -> MCEstimatorResult:
    """Estimate European option price using standard Monte Carlo simulation.

    Uses exact GBM terminal sampling:
        S_T = S0 * exp((r - q - 0.5 * sigma^2) * T + sigma * sqrt(T) * Z)

    Full NumPy vectorization without path-level loops.

    Args:
        S0: Current spot price (> 0).
        K: Strike price (> 0).
        T: Time to expiration in years.
        r: Risk-free rate (annualized).
        q: Dividend yield (annualized).
        sigma: Volatility (annualized).
        option_type: 'call' or 'put' (case-insensitive).
        n_simulations: Number of simulated terminal price paths N.
        rng: Configured NumPy Generator instance.
        base_Z: Optional pre-drawn standard normal array Z (size N). If None, drawn fresh.

    Returns:
        MCEstimatorResult: Estimator output containing price, SE, 95% CI, and performance metrics.

    Raises:
        ValueError: If option_type is not 'call' or 'put', or if n_simulations <= 0.
    """
    opt_type = option_type.lower()
    if opt_type not in ("call", "put"):
        raise ValueError(f"Invalid option_type: '{option_type}'. Must be 'call' or 'put'.")
    if n_simulations <= 0:
        raise ValueError(f"n_simulations must be positive, got {n_simulations}.")

    t_start = time.perf_counter()

    T_eff = max(T, MIN_T)
    sigma_eff = max(sigma, MIN_SIGMA)

    if base_Z is None:
        Z = rng.standard_normal(n_simulations)
    else:
        Z = np.asarray(base_Z, dtype=np.float64)

    drift = (r - q - 0.5 * sigma_eff**2) * T_eff
    vol_sqrt_T = sigma_eff * math.sqrt(T_eff)

    # Exact GBM solution for S_T
    S_T = S0 * np.exp(drift + vol_sqrt_T * Z)

    # Payoff calculation
    if opt_type == "call":
        payoffs = np.maximum(S_T - K, 0.0)
    else:
        payoffs = np.maximum(K - S_T, 0.0)

    discount_factor = math.exp(-r * T_eff)
    discounted_payoffs = discount_factor * payoffs

    # Sample mean price and standard error
    price_val = float(np.mean(discounted_payoffs))
    if n_simulations > 1:
        sample_var = float(np.var(discounted_payoffs, ddof=1))
        se = math.sqrt(sample_var) / math.sqrt(n_simulations)
    else:
        se = 0.0

    # 95% Confidence Interval
    ci_lower = price_val - 1.96 * se
    ci_upper = price_val + 1.96 * se

    t_end = time.perf_counter()
    runtime_ms = (t_end - t_start) * 1000.0
    n_effective = n_simulations
    paths_per_second = (n_effective / (runtime_ms / 1000.0)) if runtime_ms > 0 else 0.0

    return MCEstimatorResult(
        method="standard",
        price=price_val,
        standard_error=se,
        ci_lower=ci_lower,
        ci_upper=ci_upper,
        runtime_ms=runtime_ms,
        n_effective=n_effective,
        paths_per_second=paths_per_second,
    )


def estimate_antithetic(
    S0: float,
    K: float,
    T: float,
    r: float,
    q: float,
    sigma: float,
    option_type: str,
    n_pairs: int,
    rng: np.random.Generator,
    base_Z: np.ndarray | None = None,
) -> MCEstimatorResult:
    """Estimate European option price using Antithetic Variates Monte Carlo simulation.

    Evaluates option payoff for antithetic pairs (+Z_i and -Z_i) from a single set of
    standard normal draws Z_i. Monotonic option payoffs produce negatively correlated
    pair outputs, significantly reducing variance relative to standard Monte Carlo.

    Note on effective sample size: n_pairs represents the number of antithetic pairs.
    The total underlying paths evaluated is 2 * n_pairs, which is returned in n_effective.

    Args:
        S0: Current spot price (> 0).
        K: Strike price (> 0).
        T: Time to expiration in years.
        r: Risk-free rate (annualized).
        q: Dividend yield (annualized).
        sigma: Volatility (annualized).
        option_type: 'call' or 'put' (case-insensitive).
        n_pairs: Number of antithetic pairs to generate.
        rng: Configured NumPy Generator instance.
        base_Z: Optional pre-drawn standard normal array Z (size n_pairs). If None, drawn fresh.

    Returns:
        MCEstimatorResult: Estimator output containing price, SE, 95% CI, and performance metrics.

    Raises:
        ValueError: If option_type is not 'call' or 'put', or if n_pairs <= 0.
    """
    opt_type = option_type.lower()
    if opt_type not in ("call", "put"):
        raise ValueError(f"Invalid option_type: '{option_type}'. Must be 'call' or 'put'.")
    if n_pairs <= 0:
        raise ValueError(f"n_pairs must be positive, got {n_pairs}.")

    t_start = time.perf_counter()

    T_eff = max(T, MIN_T)
    sigma_eff = max(sigma, MIN_SIGMA)

    if base_Z is None:
        Z = rng.standard_normal(n_pairs)
    else:
        Z = np.asarray(base_Z, dtype=np.float64)

    drift = (r - q - 0.5 * sigma_eff**2) * T_eff
    vol_sqrt_T = sigma_eff * math.sqrt(T_eff)

    # Positive and negative terminal price paths from same Z
    S_T_pos = S0 * np.exp(drift + vol_sqrt_T * Z)
    S_T_neg = S0 * np.exp(drift - vol_sqrt_T * Z)

    # Payoff calculation
    if opt_type == "call":
        payoffs_pos = np.maximum(S_T_pos - K, 0.0)
        payoffs_neg = np.maximum(S_T_neg - K, 0.0)
    else:
        payoffs_pos = np.maximum(K - S_T_pos, 0.0)
        payoffs_neg = np.maximum(K - S_T_neg, 0.0)

    # Paired average payoffs
    paired_payoffs = 0.5 * (payoffs_pos + payoffs_neg)

    discount_factor = math.exp(-r * T_eff)
    discounted_paired_payoffs = discount_factor * paired_payoffs

    # Sample mean price and standard error across pairs
    price_val = float(np.mean(discounted_paired_payoffs))
    if n_pairs > 1:
        sample_var = float(np.var(discounted_paired_payoffs, ddof=1))
        se = math.sqrt(sample_var) / math.sqrt(n_pairs)
    else:
        se = 0.0

    # 95% Confidence Interval
    ci_lower = price_val - 1.96 * se
    ci_upper = price_val + 1.96 * se

    t_end = time.perf_counter()
    runtime_ms = (t_end - t_start) * 1000.0
    n_effective = 2 * n_pairs
    paths_per_second = (n_effective / (runtime_ms / 1000.0)) if runtime_ms > 0 else 0.0

    return MCEstimatorResult(
        method="antithetic",
        price=price_val,
        standard_error=se,
        ci_lower=ci_lower,
        ci_upper=ci_upper,
        runtime_ms=runtime_ms,
        n_effective=n_effective,
        paths_per_second=paths_per_second,
    )


def estimate_control_variate(
    S0: float,
    K: float,
    T: float,
    r: float,
    q: float,
    sigma: float,
    option_type: str,
    n_simulations: int,
    rng: np.random.Generator,
    base_Z: np.ndarray | None = None,
) -> MCEstimatorResult:
    """Estimate European option price using Control Variates Monte Carlo simulation.

    Uses underlying terminal asset price S_T as the control variate (Boyle 1977).
    Since E[S_T] under the risk-neutral measure is known analytically as S0 * exp((r - q) * T),
    the sample covariance between option payoff and S_T is used to compute the optimal beta
    coefficient and correct the Monte Carlo estimate, significantly reducing variance.

    Args:
        S0: Current spot price (> 0).
        K: Strike price (> 0).
        T: Time to expiration in years.
        r: Risk-free rate (annualized).
        q: Dividend yield (annualized).
        sigma: Volatility (annualized).
        option_type: 'call' or 'put' (case-insensitive).
        n_simulations: Number of simulated terminal price paths N.
        rng: Configured NumPy Generator instance.
        base_Z: Optional pre-drawn standard normal array Z (size N). If None, drawn fresh.

    Returns:
        MCEstimatorResult: Estimator output containing price, SE, 95% CI, and performance metrics.

    Raises:
        ValueError: If option_type is not 'call' or 'put', or if n_simulations <= 0.
    """
    opt_type = option_type.lower()
    if opt_type not in ("call", "put"):
        raise ValueError(f"Invalid option_type: '{option_type}'. Must be 'call' or 'put'.")
    if n_simulations <= 0:
        raise ValueError(f"n_simulations must be positive, got {n_simulations}.")

    t_start = time.perf_counter()

    T_eff = max(T, MIN_T)
    sigma_eff = max(sigma, MIN_SIGMA)

    if base_Z is None:
        Z = rng.standard_normal(n_simulations)
    else:
        Z = np.asarray(base_Z, dtype=np.float64)

    drift = (r - q - 0.5 * sigma_eff**2) * T_eff
    vol_sqrt_T = sigma_eff * math.sqrt(T_eff)

    # Exact terminal asset price S_T
    S_T = S0 * np.exp(drift + vol_sqrt_T * Z)

    # Risk-neutral expectation of S_T
    expected_S_T = S0 * math.exp((r - q) * T_eff)

    # Payoff calculation
    if opt_type == "call":
        payoffs = np.maximum(S_T - K, 0.0)
    else:
        payoffs = np.maximum(K - S_T, 0.0)

    discount_factor = math.exp(-r * T_eff)
    discounted_payoffs = discount_factor * payoffs

    # Estimate optimal beta coefficient from sample covariance and variance
    if n_simulations > 1:
        cov_matrix = np.cov(discounted_payoffs, S_T, ddof=1)
        var_S_T = cov_matrix[1, 1]
        cov_payoff_S_T = cov_matrix[0, 1]
        beta = (cov_payoff_S_T / var_S_T) if var_S_T > 0 else 0.0
    else:
        beta = 0.0

    # Apply control variate correction
    controlled_payoffs = discounted_payoffs - beta * (S_T - expected_S_T)

    # Sample mean price and standard error
    price_val = float(np.mean(controlled_payoffs))
    if n_simulations > 1:
        sample_var = float(np.var(controlled_payoffs, ddof=1))
        se = math.sqrt(sample_var) / math.sqrt(n_simulations)
    else:
        se = 0.0

    # 95% Confidence Interval
    ci_lower = price_val - 1.96 * se
    ci_upper = price_val + 1.96 * se

    t_end = time.perf_counter()
    runtime_ms = (t_end - t_start) * 1000.0
    n_effective = n_simulations
    paths_per_second = (n_effective / (runtime_ms / 1000.0)) if runtime_ms > 0 else 0.0

    return MCEstimatorResult(
        method="control_variate",
        price=price_val,
        standard_error=se,
        ci_lower=ci_lower,
        ci_upper=ci_upper,
        runtime_ms=runtime_ms,
        n_effective=n_effective,
        paths_per_second=paths_per_second,
    )


def estimate_antithetic_cv(
    S0: float,
    K: float,
    T: float,
    r: float,
    q: float,
    sigma: float,
    option_type: str,
    n_pairs: int,
    rng: np.random.Generator,
    base_Z: np.ndarray | None = None,
) -> MCEstimatorResult:
    """Estimate European option price using Combined Antithetic + Control Variates Monte Carlo.

    Applies antithetic pairing first to produce paired average payoffs and paired average terminal
    stock prices, then applies the control variate correction using E[S_T] = S0 * exp((r - q) * T).
    Because antithetic pairing and control variate corrections target distinct variance components,
    their variance reduction effects stack.

    Note on effective sample size: n_pairs represents the number of antithetic pairs.
    The total underlying paths evaluated is 2 * n_pairs, which is returned in n_effective.

    Args:
        S0: Current spot price (> 0).
        K: Strike price (> 0).
        T: Time to expiration in years.
        r: Risk-free rate (annualized).
        q: Dividend yield (annualized).
        sigma: Volatility (annualized).
        option_type: 'call' or 'put' (case-insensitive).
        n_pairs: Number of antithetic pairs to generate.
        rng: Configured NumPy Generator instance.
        base_Z: Optional pre-drawn standard normal array Z (size n_pairs). If None, drawn fresh.

    Returns:
        MCEstimatorResult: Estimator output containing price, SE, 95% CI, and performance metrics.

    Raises:
        ValueError: If option_type is not 'call' or 'put', or if n_pairs <= 0.
    """
    opt_type = option_type.lower()
    if opt_type not in ("call", "put"):
        raise ValueError(f"Invalid option_type: '{option_type}'. Must be 'call' or 'put'.")
    if n_pairs <= 0:
        raise ValueError(f"n_pairs must be positive, got {n_pairs}.")

    t_start = time.perf_counter()

    T_eff = max(T, MIN_T)
    sigma_eff = max(sigma, MIN_SIGMA)

    if base_Z is None:
        Z = rng.standard_normal(n_pairs)
    else:
        Z = np.asarray(base_Z, dtype=np.float64)

    drift = (r - q - 0.5 * sigma_eff**2) * T_eff
    vol_sqrt_T = sigma_eff * math.sqrt(T_eff)

    # Positive and negative terminal price paths from same Z
    S_T_pos = S0 * np.exp(drift + vol_sqrt_T * Z)
    S_T_neg = S0 * np.exp(drift - vol_sqrt_T * Z)

    # Paired average terminal stock price
    S_T_paired = 0.5 * (S_T_pos + S_T_neg)

    # Payoff calculation
    if opt_type == "call":
        payoffs_pos = np.maximum(S_T_pos - K, 0.0)
        payoffs_neg = np.maximum(S_T_neg - K, 0.0)
    else:
        payoffs_pos = np.maximum(K - S_T_pos, 0.0)
        payoffs_neg = np.maximum(K - S_T_neg, 0.0)

    # Paired average payoffs
    paired_payoffs = 0.5 * (payoffs_pos + payoffs_neg)

    discount_factor = math.exp(-r * T_eff)
    discounted_paired_payoffs = discount_factor * paired_payoffs

    # Risk-neutral expectation of S_T
    expected_S_T = S0 * math.exp((r - q) * T_eff)

    # Estimate optimal beta across paired samples
    if n_pairs > 1:
        cov_matrix = np.cov(discounted_paired_payoffs, S_T_paired, ddof=1)
        var_S_T = cov_matrix[1, 1]
        cov_payoff_S_T = cov_matrix[0, 1]
        beta = (cov_payoff_S_T / var_S_T) if var_S_T > 0 else 0.0
    else:
        beta = 0.0

    # Apply control variate correction to paired payoffs using paired S_T
    controlled_payoffs = discounted_paired_payoffs - beta * (S_T_paired - expected_S_T)

    # Sample mean price and standard error
    price_val = float(np.mean(controlled_payoffs))
    if n_pairs > 1:
        sample_var = float(np.var(controlled_payoffs, ddof=1))
        se = math.sqrt(sample_var) / math.sqrt(n_pairs)
    else:
        se = 0.0

    # 95% Confidence Interval
    ci_lower = price_val - 1.96 * se
    ci_upper = price_val + 1.96 * se

    t_end = time.perf_counter()
    runtime_ms = (t_end - t_start) * 1000.0
    n_effective = 2 * n_pairs
    paths_per_second = (n_effective / (runtime_ms / 1000.0)) if runtime_ms > 0 else 0.0

    return MCEstimatorResult(
        method="antithetic_cv",
        price=price_val,
        standard_error=se,
        ci_lower=ci_lower,
        ci_upper=ci_upper,
        runtime_ms=runtime_ms,
        n_effective=n_effective,
        paths_per_second=paths_per_second,
    )
