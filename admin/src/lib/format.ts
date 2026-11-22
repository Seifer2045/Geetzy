export const inr = (n: number | null | undefined) =>
  `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

export const num = (n: number | null | undefined) => Number(n ?? 0).toLocaleString('en-IN');

export const usd = (n: number | null | undefined) => `$${Number(n ?? 0).toFixed(2)}`;

const dtf = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
});
export const dateTime = (iso: string | null | undefined) => (iso ? dtf.format(new Date(iso)) : '—');
