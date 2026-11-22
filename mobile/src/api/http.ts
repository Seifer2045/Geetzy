import { getSupabase } from '@/auth/supabase';
import { env } from '@/config/env';
import type { Category, CreateGiftInput, Gift, LibraryItem, Template, TemplateQuery } from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** The Supabase login token, so the backend knows who is calling. */
const authHeader = async (): Promise<Record<string, string>> => {
  if (!env.realAuth) return {};
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/** FastAPI errors look like {"detail": "..."}; show that text to the user. */
const errorMessage = async (res: Response) => {
  const text = await res.text();
  try {
    const detail = (JSON.parse(text) as { detail?: unknown }).detail;
    if (typeof detail === 'string') return detail;
  } catch {
    // not JSON
  }
  return text || `Request failed (${res.status})`;
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${env.apiUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(await authHeader()), ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new ApiError(await errorMessage(res), res.status);
  return (await res.json()) as T;
};

const qs = (params: Record<string, string | undefined>) => {
  const entries = Object.entries(params).filter((e): e is [string, string] => Boolean(e[1]));
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
};

/** Real backend (FastAPI on Vercel). Same shape as mockApi. */
export const httpApi = {
  listTemplates: (q: TemplateQuery = {}) =>
    request<Template[]>(`/templates${qs({ occasion: q.occasion, category: q.category, outputType: q.outputType, style: q.style, q: q.q })}`),
  listCategories: (outputType?: string) => request<Category[]>(`/categories${qs({ outputType })}`),
  getTemplate: (id: string) => request<Template>(`/templates/${id}`),
  createGift: (input: CreateGiftInput) => request<Gift>('/gifts', { method: 'POST', body: JSON.stringify(input) }),
  getGift: (id: string) => request<Gift>(`/gifts/${id}`),
  verifyPayment: (giftId: string) => request<Gift>('/payments/verify', { method: 'POST', body: JSON.stringify({ giftId }) }),
  listLibrary: () => request<LibraryItem[]>('/library'),
  deleteAccount: () => request<{ ok: boolean }>('/me', { method: 'DELETE' }),
};
