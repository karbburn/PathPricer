"""PDF report API endpoint."""

from __future__ import annotations

import io

from fastapi import APIRouter
from fastapi.responses import JSONResponse, StreamingResponse

from ..api.pricing import run_full_simulation, validate_request
from ..core.config import MAX_N_SIMULATIONS
from ..report.generator import generate_report
from ..schemas.pricing import PricingRequestSchema

router = APIRouter(prefix="/report", tags=["report"])


@router.post("/pdf", response_model=None)
def generate_pdf_report(req: PricingRequestSchema):
    """Generate PDF report by re-running full simulation (same seed → identical output)."""
    validation_err = validate_request(req, max_n=MAX_N_SIMULATIONS)
    if validation_err is not None:
        return JSONResponse(status_code=400, content=validation_err.model_dump())

    full_response = run_full_simulation(req)
    pdf_bytes = generate_report(full_response)

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=pathpricer_report.pdf"},
    )
