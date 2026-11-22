// Same rule as backend/app/services/pricing.py: Google Play can only charge fixed tiers,
// so a custom price is billed at the NEAREST tier (a tie goes to the cheaper one).
export type Tier = { id: string; price_inr: number };

export function nearestTier<T extends Tier>(price: number, tiers: T[]): T {
  return tiers.reduce((best, t) => {
    const d = Math.abs(t.price_inr - price), bd = Math.abs(best.price_inr - price);
    return d < bd || (d === bd && t.price_inr < best.price_inr) ? t : best;
  });
}
