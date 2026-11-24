import { create } from 'zustand';
import type { Language, Mood, MusicStyle, Occasion, Relationship, Singer, SongDraft, SongSource, Trait } from '@/api/types';

/** Random id for one create flow (the server allows one personal song per id). */
export const newDraftId = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

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
  language: Language;
  musicStyle: MusicStyle | null;
  relationship: Relationship | null;
  traits: Trait[];
  idea: string;
  /** The song made on the song screen (one per flow). */
  draftId: string;
  songDraft: SongDraft | null;
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
  language: 'hinglish' as Language,
  musicStyle: null as MusicStyle | null,
  relationship: null as Relationship | null,
  traits: [] as Trait[],
  idea: '',
  songDraft: null as SongDraft | null,
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
  draftId: newDraftId(),
  set: (patch) => set(patch),
  addPhotos: (photos, max) => set((s) => ({ photos: [...s.photos, ...photos].slice(0, max) })),
  removePhoto: (id) => set((s) => ({ photos: s.photos.filter((p) => p.id !== id) })),
  reset: () => set({ ...initial, draftId: newDraftId() }),
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
    return {
      type: 'ai',
      mood: s.mood,
      singer: s.singer,
      version: s.version,
      lyrics: s.lyrics ?? '',
      draftId: s.songDraft ? s.draftId : undefined,
      prefs: { language: s.language, musicStyle: s.musicStyle, relationship: s.relationship, traits: s.traits, idea: s.idea.trim() },
    };
  },
}));
