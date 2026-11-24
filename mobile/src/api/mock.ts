import type { Category, CreateGiftInput, Gift, GiftStatus, LibraryItem, SongDraft, SongDraftInput, Template, TemplateQuery } from './types';
import { OCCASIONS } from '@/constants/catalog';
import { libraryItems, templates } from './mockData';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Simulated generation time for a gift (the real one is ~1–2 min). */
const JOB_MS = 14_000;

type StoredGift = Omit<Gift, 'status' | 'progress'> & { startedAt: number; paid: boolean };
const gifts = new Map<string, StoredGift>();
let giftSeq = 2000;
const madeDrafts = new Set<string>();

const statusFor = (p: number): GiftStatus => {
  if (p < 0.08) return 'queued';
  if (p < 0.3) return 'writing_lyrics';
  if (p < 0.6) return 'composing';
  if (p < 1) return 'rendering';
  return 'preview_ready';
};

const materialize = (g: StoredGift): Gift => {
  const progress = Math.min(1, (Date.now() - g.startedAt) / JOB_MS);
  const status: GiftStatus = g.paid ? 'paid' : statusFor(progress);
  return { ...g, progress, status, previewUrl: progress >= 1 ? 'mock://preview' : null, hdUrl: g.paid ? 'mock://hd' : null };
};

const findTemplate = (id: string) => templates.find((t) => t.id === id);

export const mockApi = {
  async listTemplates(query: TemplateQuery = {}): Promise<Template[]> {
    await delay(350);
    const q = query.q?.trim().toLowerCase();
    return templates.filter(
      (t) =>
        (!query.occasion || t.occasion === query.occasion) &&
        (!query.category || t.occasion === query.category) &&
        (!query.style || t.style === query.style) &&
        (!q || t.name.toLowerCase().includes(q) || t.tags.some((tag) => tag.toLowerCase().includes(q))),
    );
  },

  async listCategories(): Promise<Category[]> {
    await delay(200);
    return OCCASIONS.filter((o) => !o.soon).map((o) => ({
      id: o.id, slug: o.id, name: o.label, emoji: null, colors: o.colors, outputType: 'song_video' as const,
    }));
  },

  async getTemplate(id: string): Promise<Template> {
    await delay(250);
    const t = findTemplate(id);
    if (!t) throw new Error(`Template ${id} not found`);
    return t;
  },

  async createGift(input: CreateGiftInput): Promise<Gift> {
    await delay(500);
    const t = findTemplate(input.templateId);
    if (!t) throw new Error('Template not found');
    const id = `GFT-${++giftSeq}`;
    const stored: StoredGift = {
      id,
      templateId: t.id,
      templateName: t.name,
      occasion: t.occasion,
      recipientName: input.recipientName,
      senderName: input.senderName,
      createdAt: new Date().toISOString(),
      colors: t.colors,
      price: t.price,
      previewUrl: null,
      hdUrl: null,
      startedAt: Date.now(),
      paid: false,
    };
    gifts.set(id, stored);
    return materialize(stored);
  },

  /** Mock: a public sample track after a short wait, and the same "one song per flow" rule as the server. */
  async makeSongDraft(input: SongDraftInput): Promise<SongDraft> {
    await delay(2200);
    if (madeDrafts.has(input.draftId)) throw new Error('One song per video. Your song is ready; extra songs are coming soon.');
    madeDrafts.add(input.draftId);
    return { audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', durationSec: 15, triesUsed: 1, triesLeft: 0 };
  },

  async getGift(id: string): Promise<Gift> {
    await delay(150);
    const g = gifts.get(id);
    if (!g) {
      // Seeded library items: treat as finished previews
      const lib = libraryItems.find((l) => l.giftId === id);
      const t = templates[0]!;
      return {
        id,
        templateId: t.id,
        templateName: lib?.subtitle.split('· ')[1] ?? t.name,
        occasion: 'birthday',
        recipientName: lib?.title.replace('For ', '') ?? 'Priya',
        senderName: 'Rahul',
        status: lib?.status === 'hd' ? 'paid' : 'preview_ready',
        progress: 1,
        createdAt: lib?.createdAt ?? new Date().toISOString(),
        previewUrl: 'mock://preview',
        hdUrl: lib?.status === 'hd' ? 'mock://hd' : null,
        colors: lib?.colors ?? t.colors,
        price: t.price,
      };
    }
    return materialize(g);
  },

  async deleteAccount(): Promise<{ ok: boolean }> {
    await delay(400);
    return { ok: true };
  },

  /** In production: verify the Play Billing purchase token on the server. */
  async verifyPayment(giftId: string): Promise<Gift> {
    await delay(900);
    const g = gifts.get(giftId);
    if (g) g.paid = true;
    return mockApi.getGift(giftId);
  },

  async listLibrary(): Promise<LibraryItem[]> {
    await delay(300);
    const created: LibraryItem[] = [...gifts.values()].map((stored) => {
      const g = materialize(stored);
      return {
        id: `LIB-${g.id}`,
        kind: 'video',
        title: `For ${g.recipientName}`,
        subtitle: `${g.occasion[0]!.toUpperCase()}${g.occasion.slice(1)} · ${g.templateName}`,
        status: g.status === 'paid' ? 'hd' : g.status === 'preview_ready' ? 'preview' : 'making',
        progress: g.progress,
        colors: g.colors,
        giftId: g.id,
        createdAt: g.createdAt,
      };
    });
    return [...created.reverse(), ...libraryItems];
  },
};
