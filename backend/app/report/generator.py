"""PDF report generator using ReportLab.

Produces a research-note-style PDF report from a PricingFullResponse object.
Content includes: inputs, BS price + Greeks, MC comparison table (all 4 estimators),
convergence chart (matplotlib embedded), diagnostics, and assumptions table.

Uses shared formatting from core/formatting.py.
"""

from __future__ import annotations

import io
import math
from datetime import datetime, timezone

import matplotlib
matplotlib.use("Agg")  # Non-interactive backend for server-side rendering
import matplotlib.pyplot as plt
import numpy as np

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch, mm
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from ..core.formatting import format_greek, format_percentage, format_price
from ..schemas.pricing import PricingFullResponse


def _make_table(data, colWidths, font_size=9, padding=8, valign="MIDDLE", align_right=False):
    t = Table(data, colWidths=colWidths)
    cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), font_size),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
        ("VALIGN", (0, 0), (-1, -1), valign),
    ]
    if align_right:
        cmds.append(("ALIGN", (1, 0), (-1, -1), "RIGHT"))
    cmds += [
        ("LEFTPADDING", (0, 0), (-1, -1), padding),
        ("RIGHTPADDING", (0, 0), (-1, -1), padding),
        ("TOPPADDING", (0, 0), (-1, -1), max(3, padding - 4)),
        ("BOTTOMPADDING", (0, 0), (-1, -1), max(3, padding - 4)),
    ]
    t.setStyle(TableStyle(cmds))
    return t


# ---------------------------------------------------------------------------
# Assumptions table data
# ---------------------------------------------------------------------------

_ASSUMPTIONS = [
    (
        "Constant volatility",
        "Implied vol varies by strike/expiry (smile/skew)",
        "Single σ input (historical or manual); smile modeling named as future work",
    ),
    (
        "GBM / log-normal returns",
        "Real returns exhibit fat tails and negative skew",
        "GBM used; jump-diffusion named as the standard extension",
    ),
    (
        "Constant risk-free rate",
        "Rates have term structure and evolve stochastically",
        "Flat r input; BondFactor-curve integration hook noted as future fix",
    ),
    (
        "Continuous dividend yield",
        "Real dividends are discrete, scheduled cash payments",
        "Continuous q approximation from trailing yield",
    ),
    (
        "European exercise only",
        "Most single-name US equity options are American",
        "Scope limitation; Longstaff-Schwartz named as MC extension",
    ),
    (
        "Frictionless markets",
        "Real trading has bid-ask spreads, transaction costs",
        "Not modeled; pricing-model vs. trading-system distinction",
    ),
    (
        "Risk-neutral pricing",
        "Physical measure drift ≠ risk-neutral drift",
        "Prices under Q measure, appropriate for pricing/hedging",
    ),
]


def _build_convergence_chart(convergence_data: list, convergence_fit) -> bytes:
    """Render a log-log convergence chart (SE vs N) as PNG bytes.

    Args:
        convergence_data: List of ConvergencePoint objects with n and standard_error.
        convergence_fit: ConvergenceFit object with slope and r_squared.

    Returns:
        bytes: PNG image data.
    """
    ns = [p.n for p in convergence_data]
    ses = [p.standard_error for p in convergence_data]

    fig, ax = plt.subplots(figsize=(5.5, 3.2), dpi=150)
    ax.loglog(ns, ses, "o-", color="#2563eb", markersize=5, linewidth=1.5, label="Empirical SE")

    # Fitted line
    if len(ns) >= 2 and all(se > 0 for se in ses):
        log_n = np.log(ns)
        log_se = np.log(ses)
        coeffs = np.polyfit(log_n, log_se, 1)
        fitted_se = np.exp(np.polyval(coeffs, log_n))
        ax.loglog(ns, fitted_se, "--", color="#dc2626", linewidth=1,
                  label=f"Fit: slope = {convergence_fit.slope:.3f}")

    ax.set_xlabel("Number of Simulations (N)", fontsize=9)
    ax.set_ylabel("Standard Error", fontsize=9)
    ax.set_title("Monte Carlo Convergence: SE vs N", fontsize=10, fontweight="bold")
    ax.legend(fontsize=8)
    ax.grid(True, alpha=0.3)
    fig.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return buf.read()


def generate_report(pricing_response: PricingFullResponse) -> bytes:
    """Generate a research-note-style PDF report from full pricing results.

    Args:
        pricing_response: Complete PricingFullResponse from /price/full endpoint.

    Returns:
        bytes: PDF document bytes.
    """
    resp = pricing_response
    req = resp.request_echo
    bs = resp.black_scholes
    fd = resp.greeks_fd

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("ReportTitle", parent=styles["Title"], fontSize=18,
                                  spaceAfter=6, textColor=colors.HexColor("#1e3a5f"))
    subtitle_style = ParagraphStyle("Subtitle", parent=styles["Normal"], fontSize=9,
                                     textColor=colors.grey, spaceAfter=12)
    heading_style = ParagraphStyle("SectionHead", parent=styles["Heading2"], fontSize=12,
                                    spaceAfter=6, spaceBefore=14,
                                    textColor=colors.HexColor("#1e3a5f"))
    body_style = styles["Normal"]
    small_style = ParagraphStyle("Small", parent=styles["Normal"], fontSize=8,
                                  textColor=colors.grey)

    elements: list = []

    # -----------------------------------------------------------------------
    # Title
    # -----------------------------------------------------------------------
    elements.append(Paragraph("PathPricer — Pricing Report", title_style))
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    elements.append(Paragraph(f"Generated {ts} | Tier: Full Simulation", subtitle_style))
    elements.append(Spacer(1, 6))

    # -----------------------------------------------------------------------
    # 1. Input Parameters
    # -----------------------------------------------------------------------
    elements.append(Paragraph("1. Input Parameters", heading_style))

    input_data = [
        ["Parameter", "Value"],
        ["Ticker / Market", f"{req.ticker} ({req.market})"],
        ["Option Type", req.option_type.upper()],
        ["Strike", format_price(req.strike)],
        ["Expiry Date", str(req.expiry_date)],
        ["Spot Override", format_price(req.spot_override) if req.spot_override else "Market"],
        ["Volatility (σ)", format_percentage(req.volatility)],
        ["Risk-Free Rate (r)", format_percentage(req.risk_free_rate)],
        ["Dividend Yield (q)", format_percentage(req.dividend_yield) if req.dividend_yield else "0.00%"],
        ["Simulations (N)", f"{req.n_simulations:,}"],
        ["Seed", str(req.seed)],
        ["Variance Reduction", req.variance_reduction],
    ]
    elements.append(_make_table(input_data, colWidths=[140, 340]))
    elements.append(Spacer(1, 10))

    # -----------------------------------------------------------------------
    # 2. Black-Scholes Analytical Results
    # -----------------------------------------------------------------------
    elements.append(Paragraph("2. Black-Scholes Analytical Price &amp; Greeks", heading_style))

    bs_data = [
        ["Metric", "Value"],
        ["BS Price", format_price(bs.price, 4)],
        ["Delta", format_greek(bs.greeks.delta)],
        ["Gamma", format_greek(bs.greeks.gamma)],
        ["Vega", format_greek(bs.greeks.vega)],
        ["Theta (per day)", format_greek(bs.greeks.theta)],
        ["Rho", format_greek(bs.greeks.rho)],
    ]
    elements.append(_make_table(bs_data, colWidths=[140, 340]))
    elements.append(Spacer(1, 10))

    # -----------------------------------------------------------------------
    # 3. Monte Carlo Comparison Table
    # -----------------------------------------------------------------------
    elements.append(Paragraph("3. Monte Carlo Estimator Comparison", heading_style))

    mc_header = ["Method", "Price", "SE", "95% CI", "Runtime (ms)", "N_eff", "Paths/sec"]
    mc_rows = [mc_header]
    for mc in resp.mc_results:
        mc_rows.append([
            "Randomized QMC (Sobol)"
            if mc.method == "quasi_monte_carlo"
            else mc.method.replace("_", " ").title(),
            format_price(mc.price, 4),
            format_price(mc.standard_error, 4),
            f"[{format_price(mc.ci_lower, 2)}, {format_price(mc.ci_upper, 2)}]",
            f"{mc.runtime_ms:.1f}",
            f"{mc.n_effective:,}",
            f"{mc.paths_per_second:,.0f}",
        ])

    elements.append(_make_table(mc_rows, colWidths=[105, 55, 50, 95, 55, 55, 65], font_size=7.5, padding=3, align_right=True))
    elements.append(Spacer(1, 10))

    # -----------------------------------------------------------------------
    # 4. Finite-Difference Greeks
    # -----------------------------------------------------------------------
    elements.append(Paragraph("4. Finite-Difference Greeks (CRN)", heading_style))

    fd_data = [
        ["Greek", "FD Value", "BS Value", "Difference"],
        ["Delta", format_greek(fd.delta), format_greek(bs.greeks.delta),
         format_greek(fd.delta - bs.greeks.delta)],
        ["Gamma", format_greek(fd.gamma), format_greek(bs.greeks.gamma),
         format_greek(fd.gamma - bs.greeks.gamma)],
        ["Vega", format_greek(fd.vega), format_greek(bs.greeks.vega),
         format_greek(fd.vega - bs.greeks.vega)],
        ["Theta", format_greek(fd.theta), format_greek(bs.greeks.theta),
         format_greek(fd.theta - bs.greeks.theta)],
        ["Rho", format_greek(fd.rho), format_greek(bs.greeks.rho),
         format_greek(fd.rho - bs.greeks.rho)],
    ]
    elements.append(_make_table(fd_data, colWidths=[90, 130, 130, 130], align_right=True))
    elements.append(Spacer(1, 10))

    # -----------------------------------------------------------------------
    # 5. Convergence Chart (embedded PNG)
    # -----------------------------------------------------------------------
    elements.append(Paragraph("5. Convergence Analysis", heading_style))

    if resp.convergence_data:
        chart_png = _build_convergence_chart(resp.convergence_data, resp.convergence_fit)
        chart_buf = io.BytesIO(chart_png)
        chart_img = Image(chart_buf, width=5.5 * inch, height=3.2 * inch)
        elements.append(chart_img)
        elements.append(Spacer(1, 4))
        elements.append(Paragraph(
            f"Fitted slope: {resp.convergence_fit.slope:.3f} "
            f"(theoretical: −0.500) | R² = {resp.convergence_fit.r_squared:.3f}",
            small_style,
        ))
    elements.append(Spacer(1, 10))

    # -----------------------------------------------------------------------
    # 6. Diagnostics
    # -----------------------------------------------------------------------
    elements.append(Paragraph("6. Diagnostics", heading_style))

    diag = resp.diagnostics
    diag_data = [
        ["Metric", "Value"],
        ["Expected Payoff", format_price(diag.expected_payoff)],
        ["Discount Factor", f"{diag.discount_factor:.4f}"],
        ["Terminal Mean (S_T)", format_price(diag.terminal_mean)],
        ["Terminal Std (S_T)", format_price(diag.terminal_std)],
        ["Relative Error vs BS", format_percentage(diag.relative_error_vs_bs, 4)],
        ["Total Compute Time", f"{resp.compute_ms:.1f} ms"],
    ]
    elements.append(_make_table(diag_data, colWidths=[140, 340]))
    elements.append(Spacer(1, 10))

    # -----------------------------------------------------------------------
    # 7. Assumptions & Limitations
    # -----------------------------------------------------------------------
    elements.append(Paragraph("7. Model Assumptions &amp; Limitations", heading_style))

    assumptions_header = ["Assumption", "Reality", "v1 Treatment"]
    assumptions_rows = [assumptions_header] + [list(row) for row in _ASSUMPTIONS]
    elements.append(_make_table(assumptions_rows, colWidths=[130, 160, 190], font_size=7.5, padding=4, valign="TOP"))
    elements.append(Spacer(1, 14))

    # -----------------------------------------------------------------------
    # Footer
    # -----------------------------------------------------------------------
    elements.append(Paragraph(
        "This report was generated by PathPricer. All results are reproducible "
        f"with seed={req.seed}. Numbers computed under risk-neutral measure (Q).",
        small_style,
    ))

    doc.build(elements)
    return buf.getvalue()
