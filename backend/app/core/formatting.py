"""Shared formatting helpers for consistent number presentation.

Used by both api/ routes and report/generator.py so that a price shown
in the JSON API and the same price in a PDF report are formatted identically.
"""


def format_price(value: float, decimals: int = 2) -> str:
    """Format a price value to a fixed number of decimal places.

    Args:
        value: The price value.
        decimals: Number of decimal places (default 2).

    Returns:
        str: Formatted price string (e.g. '142.18').
    """
    return f"{value:,.{decimals}f}"


def format_greek(value: float, decimals: int = 5) -> str:
    """Format a Greek sensitivity value.

    Args:
        value: The Greek value.
        decimals: Number of decimal places (default 5).

    Returns:
        str: Formatted Greek string (e.g. '0.51200').
    """
    return f"{value:.{decimals}f}"


def format_percentage(value: float, decimals: int = 2) -> str:
    """Format a decimal as a percentage string.

    Args:
        value: The decimal value (e.g. 0.25 for 25%).
        decimals: Number of decimal places (default 2).

    Returns:
        str: Formatted percentage string (e.g. '25.00%').
    """
    return f"{value * 100:.{decimals}f}%"


def format_currency(value: float, currency: str = "USD", decimals: int = 2) -> str:
    """Format a currency value with symbol prefix.

    Args:
        value: The monetary amount.
        currency: Currency code (default 'USD').
        decimals: Number of decimal places (default 2).

    Returns:
        str: Formatted currency string (e.g. '$142.18' or '₹2,945.30').
    """
    symbols = {"USD": "$", "INR": "₹", "EUR": "€", "GBP": "£"}
    symbol = symbols.get(currency.upper(), currency + " ")
    return f"{symbol}{value:,.{decimals}f}"


def format_integer(value: int) -> str:
    """Format an integer with thousands separators.

    Args:
        value: The integer value.

    Returns:
        str: Formatted integer string (e.g. '500,000').
    """
    return f"{value:,}"


def format_scientific(value: float, decimals: int = 4) -> str:
    """Format a value in scientific notation.

    Args:
        value: The numeric value.
        decimals: Number of decimal places (default 4).

    Returns:
        str: Formatted scientific string (e.g. '1.2345e-03').
    """
    return f"{value:.{decimals}e}"
