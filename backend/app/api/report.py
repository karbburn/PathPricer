"""PDF report API endpoints.

POST /report/pdf — placeholder returning 501 Not Implemented.
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/report", tags=["report"])


@router.post("/pdf")
def generate_pdf_report() -> JSONResponse:
    """Generate PDF report — not yet implemented."""
    return JSONResponse(
        status_code=501,
        content={"error": "not_implemented", "message": "PDF report generation is not yet available."},
    )
