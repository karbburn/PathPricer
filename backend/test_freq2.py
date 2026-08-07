"""Frequency sweep with more simulations for stable results."""
from app.engine.hedging_comparison import compare_hedging
from app.engine.heston import HestonParams

params = HestonParams(v0=0.04, kappa=2.0, theta_v=0.04, sigma_v=0.5, rho=-0.8)

for n in [21, 63, 126, 252]:
    result = compare_hedging(
        S0=100, K=100, T=0.25, r=0.05, q=0.0,
        option_type="call", heston_params=params,
        n_rebalance=n, n_simulations=1000, tc_bps=5.0, seed=42,
    )
    bs_v = result["bs"]["variance"]
    h_v = result["heston"]["variance"]
    ratio = result["variance_ratio"]
    pct = result["variance_pct_improvement"]
    print(f"n={n:>3d} | BS: {bs_v:.4f} | Heston: {h_v:.4f} | ratio: {ratio:.2f} | improvement: {pct:.1f}%")
