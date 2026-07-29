"""Manual test script to query real tickers via MarketDataService."""

from backend.app.providers.market_data import MarketDataService

def main():
    service = MarketDataService()
    tickers = [
        ("AAPL", "US"),
        ("MSFT", "US"),
        ("RELIANCE", "IN"),
        ("TCS", "IN"),
        ("SPY", "US"),
    ]

    print("=== MARKET DATA SERVICE MANUAL GATE CHECK ===")
    for ticker, market in tickers:
        try:
            quote = service.get_quote(ticker, market)
            print(f"\nTicker: {quote.ticker} ({quote.market}) -> Resolved: {quote.resolved_symbol}")
            print(f"  Spot Price: {quote.spot_price:.2f} {quote.currency}")
            print(f"  Daily Return: {quote.daily_return * 100:.2f}%")
            print(f"  Dividend Yield: {quote.dividend_yield * 100:.2f}%")
            print(f"  Market Cap: {quote.market_cap:,.0f}" if quote.market_cap else "  Market Cap: N/A")
            print(f"  Historical Volatility (annualized):")
            for window, vol in quote.historical_volatility.items():
                print(f"    {window}: {vol * 100:.2f}%")
            print(f"  Data Warnings: {quote.data_warnings}")
        except Exception as e:
            print(f"ERROR fetching {ticker} ({market}): {e}")

if __name__ == "__main__":
    main()
