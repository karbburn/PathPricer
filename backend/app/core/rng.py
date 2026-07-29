"""Centralized Random Number Generator factory.

Enforces reproducibility contract and ensures no direct calls to legacy
global np.random state anywhere in engine.
"""

import numpy as np


def make_rng(seed: int | None = None) -> np.random.Generator:
    """Create a NumPy Generator instance with specified seed.

    Args:
        seed: Optional integer seed for reproducibility.

    Returns:
        np.random.Generator: Configured Random Number Generator.
    """
    return np.random.default_rng(seed)
