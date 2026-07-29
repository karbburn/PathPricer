"""Generate a test PDF report for manual verification gate."""

from datetime import date, timedelta
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

future_date = (date.today() + timedelta(days=90)).isoformat()
payload = {
    "ticker": "AAPL",
    "market": "US",
    "spot_override": 340.0,
    "strike": 350.0,
    "expiry_date": future_date,
    "option_type": "call",
    "volatility": 0.25,
    "risk_free_rate": 0.05,
    "dividend_yield": 0.003,
    "n_simulations": 100000,
    "seed": 42,
    "variance_reduction": "all",
}

resp = client.post("/api/v1/report/pdf", json=payload)

if resp.status_code == 200:
    output_path = "scripts/test_report.pdf"
    with open(output_path, "wb") as f:
        f.write(resp.content)
    print(f"PDF generated successfully: {output_path} ({len(resp.content):,} bytes)")
else:
    print(f"ERROR: status {resp.status_code}")
    print(resp.text)
