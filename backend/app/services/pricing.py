"""Price rules. A template may have a custom price; Google Play can only charge fixed tiers.

The app and the DB (`create_gift`) use the custom price. Play Billing charges the NEAREST tier until
more Play products are created. The admin picks that tier when saving (same function, mirrored in TypeScript).
"""
from typing import Iterable


def effective_price(row: dict) -> int:
    """Custom price if the admin set one, else the price tier's price."""
    custom = row.get("custom_price_inr")
    return int(custom) if custom else int(row["price_tiers"]["price_inr"])


def nearest_tier(price: int, tiers: Iterable[dict]) -> dict:
    """Tier with the closest price. A tie goes to the cheaper tier (we never charge more than the shown price)."""
    return min(tiers, key=lambda t: (abs(t["price_inr"] - price), t["price_inr"]))
