import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { env } from '@/config/env';
import { api } from './client';
import type { CreateGiftInput, LyricsInput, TemplateQuery } from './types';

export const queryKeys = {
  templates: (q: TemplateQuery) => ['templates', q] as const,
  template: (id: string) => ['template', id] as const,
  gift: (id: string) => ['gift', id] as const,
  library: ['library'] as const,
};

export const useTemplates = (q: TemplateQuery = {}) =>
  useQuery({ queryKey: queryKeys.templates(q), queryFn: () => api.listTemplates(q) });

export const useTemplate = (id: string | undefined) =>
  useQuery({ queryKey: queryKeys.template(id ?? ''), queryFn: () => api.getTemplate(id ?? ''), enabled: Boolean(id) });

/** Real generation takes ~1 min, so poll the server gently; the mock is instant. */
const POLL_MS = env.useMock ? 700 : 3000;

/** Polls while the gift is being made, and after payment until the HD video exists. */
export const useGift = (id: string | undefined) =>
  useQuery({
    queryKey: queryKeys.gift(id ?? ''),
    queryFn: () => api.getGift(id ?? ''),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const g = query.state.data;
      if (!g) return POLL_MS;
      const finished = g.status === 'failed' || g.status === 'preview_ready' || (g.status === 'paid' && Boolean(g.hdUrl));
      return finished ? false : POLL_MS;
    },
  });

/**
 * Gemini writes the lyrics on the server (mock: local sample lyrics).
 * Cached per template + name + fun fact + mood + version, so V1/V2/V3 switch instantly once made.
 * Singer only changes the music, not the words, so it is not part of the key.
 */
export const useLyrics = (input: LyricsInput | null) =>
  useQuery({
    queryKey: ['lyrics', input?.templateId, input?.recipientName, input?.funFact, input?.mood, input?.version] as const,
    queryFn: () => api.generateLyrics(input!),
    enabled: Boolean(input),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: 1,
  });

export const useDeleteAccount = () => useMutation({ mutationFn: () => api.deleteAccount() });

export const useLibrary = () => useQuery({ queryKey: queryKeys.library, queryFn: () => api.listLibrary() });

export const useCreateGift = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGiftInput) => api.createGift(input),
    onSuccess: (gift) => {
      qc.setQueryData(queryKeys.gift(gift.id), gift);
      void qc.invalidateQueries({ queryKey: queryKeys.library });
    },
  });
};

export const useVerifyPayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (giftId: string) => api.verifyPayment(giftId),
    onSuccess: (gift) => {
      qc.setQueryData(queryKeys.gift(gift.id), gift);
      void qc.invalidateQueries({ queryKey: queryKeys.library });
    },
  });
};
