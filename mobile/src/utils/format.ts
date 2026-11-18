export const formatPrice = (amount: number, currency: 'INR' = 'INR') =>
  currency === 'INR' ? `₹${amount}` : `${amount} ${currency}`;

export const discountPercent = (price: number, original: number | null) =>
  original && original > price ? Math.round(((original - price) / original) * 100) : null;

export const formatCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}k` : String(n));

/** 75.5 -> "1:15.5" (tenths optional) */
export const formatTime = (sec: number, tenths = false) => {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  const whole = Math.floor(rest);
  const base = `${m}:${String(whole).padStart(2, '0')}`;
  return tenths ? `${base}.${Math.floor((rest - whole) * 10)}` : base;
};

export const greeting = (date = new Date()) => {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
