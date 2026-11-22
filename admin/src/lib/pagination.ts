// Keyset ("seek") pagination helpers: cheap on any table size, unlike OFFSET.
export const PAGE_SIZE = 25;

export type Cursor = { t: string; id: string };

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url');
}

export function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(Buffer.from(raw, 'base64url').toString());
    return typeof c.t === 'string' && typeof c.id === 'string' ? c : null;
  } catch {
    return null;
  }
}

/** PostgREST `or` filter for "rows after this cursor" when sorted by (created_at desc, id desc). */
export function afterCursor(c: Cursor): string {
  return `created_at.lt.${c.t},and(created_at.eq.${c.t},id.lt.${c.id})`;
}

/** Remove characters that have meaning inside a PostgREST filter string. */
export function safeSearch(q: string | undefined): string {
  return (q ?? '').replace(/[%,()*\\]/g, ' ').trim().slice(0, 60);
}
