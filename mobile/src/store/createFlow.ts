import { create } from 'zustand';
import type { Mood, Occasion, Singer, SongSource } from '@/api/types';

export type PickedPhoto = { uri: string; id: string };
export type PickedSong = { name: string; uri: string; durationSec: number };

type CreateFlowState = {
  occasion: Occasion;
  templateId: string | null;
  photos: PickedPhoto[];
  recipientName: string;
  senderName: string;
  funFact: string;
  // song
  songSource: 'ai' | 'upload';
  mood: Mood;
  singer: Singer;
  version: number;
  retriesLeft: number;
  lyrics: string | null;
  upload: PickedSong | null;
  rightsConfirmed: boolean;
  trimStartSec: number;
  fade: boolean;
  giftId: string | null;

  set: (patch: Partial<Omit<CreateFlowState, 'set' | 'reset' | 'addPhotos' | 'removePhoto'>>) => void;
  addPhotos: (photos: PickedPhoto[], max: number) => void;
  removePhoto: (id: string) => void;
  reset: () => void;
  /** `uploadPath` = where the own song was uploaded in Supabase Storage (mock: the local uri). */
  songPayload: (uploadPath?: string) => SongSource;
};

const initial = {
  occasion: 'birthday' as Occasion,
  templateId: null,
  photos: [] as PickedPhoto[],
  recipientName: '',
  senderName: '',
  funFact: '',
  songSource: 'ai' as const,
  mood: 'happy' as Mood,
  singer: 'female' as Singer,
  version: 1,
  retriesLeft: 2,
  lyrics: null,
  upload: null,
  rightsConfirmed: false,
  trimStartSec: 0,
  fade: true,
  giftId: null,
};

export const useCreateFlow = create<CreateFlowState>()((set, get) => ({
  ...initial,
  set: (patch) => set(patch),
  addPhotos: (photos, max) => set((s) => ({ photos: [...s.photos, ...photos].slice(0, max) })),
  removePhoto: (id) => set((s) => ({ photos: s.photos.filter((p) => p.id !== id) })),
  reset: () => set(initial),
  songPayload: (uploadPath) => {
    const s = get();
    if (s.songSource === 'upload' && s.upload) {
      return {
        type: 'upload',
        fileName: s.upload.name,
        storagePath: uploadPath ?? s.upload.uri,
        durationSec: s.upload.durationSec,
        trimStartSec: s.trimStartSec,
        fade: s.fade,
      };
    }
    return { type: 'ai', mood: s.mood, singer: s.singer, version: s.version, lyrics: s.lyrics ?? '' };
  },
}));
