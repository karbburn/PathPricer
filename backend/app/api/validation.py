"""Validation summary API endpoint.

GET /validation/summary — serves static CI-time validation artifact JSON.
Doc 6 §5: STATIC CI ARTIFACT ONLY. NEVER calls /price/full or computes live.
"""

from __future__ import annotations

import json
from pathlib import Path
from fastapi import APIRouter

from ..schemas.pricing import ValidationSummaryResponse

router = APIRouter(prefix="/validation", tags=["validation"])

# Path to static CI artifact file
_ARTIFACT_PATH = Path(__file__).parent.parent / "validation_summary.json"


@router.get("/summary", response_model=ValidationSummaryResponse)
def get_validation_summary() -> ValidationSummaryResponse:
    """Fetch static CI validation summary artifact.

    Serves pre-computed CI coverage and edge-case results generated during
    automated CI runs. Does NOT trigger live simulation compute.
    """
    if _ARTIFACT_PATH.exists():
        with open(_ARTIFACT_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return ValidationSummaryResponse(**data)

    # Empty state fallback before first CI run
    return ValidationSummaryResponse(
        ci_coverage={
            "trials": 200,
            "nominal_confidence": 0.95,
            "observed_coverage": None,
            "last_run": None,
        },
        edge_cases={
            "total": 0,
            "passed": 0,
            "last_run": None,
        },
        greeks_validation={
            "total": 0,
            "passed": 0,
            "tolerances": {
                "delta": 0.02,
                "gamma": 0.05,
                "vega": 0.03,
                "theta": 0.05,
                "rho": 0.03,
            },
        },
    )
