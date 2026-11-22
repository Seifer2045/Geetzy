// API contract — keep in sync with backend/app/schemas.py

export type Occasion = 'birthday' | 'anniversary' | 'apology' | 'festival';
export type TemplateStyle = 'bollywood' | 'retro' | 'genz';
export type Mood = 'happy' | 'filmy' | 'romantic' | 'party';
export type Singer = 'female' | 'male' | 'duet';

export type Template = {
  id: string;
  name: string;
  occasion: Occasion;
  style: TemplateStyle;
  /** Price in INR, decided by the server (dynamic). */
  price: number;
  /** Shown struck-through when present. */
  originalPrice: number | null;
  currency: 'INR';
  durationSec: number;
  photosMin: number;
  photosMax: number;
  madeCount: number;
  description: string;
  tags: string[];
  /** Thumbnail gradient until real preview images exist. */
  colors: readonly [string, string];
  previewUrl: string | null;
  trending: boolean;
  // Managed from the admin dashboard. Older servers omit these, so they are optional.
  categoryId?: string | null;
  /** Category slug (same as the old occasion for the built-in ones). */
  category?: string | null;
  orientation?: Orientation;
  outputType?: OutputType;
  songMode?: SongMode;
  thumbUrl?: string | null;
  /** What previewUrl points to. */
  previewType?: 'video' | 'image';
};

export type Orientation = 'vertical' | 'horizontal';
/** song_video = video with a song, image = styled photo (no song). */
export type OutputType = 'song_video' | 'image';
/** Which song choices the template allows. 'none' = no song step at all. */
export type SongMode = 'ai' | 'upload' | 'both' | 'none';

export type Category = {
  id: string;
  slug: string;
  name: string;
  emoji: string | null;
  colors: readonly [string, string];
  outputType: OutputType;
};

export type TemplateQuery = {
  occasion?: Occasion;
  /** Category slug (admin-managed). */
  category?: string;
  outputType?: OutputType;
  style?: TemplateStyle;
  q?: string;
};

export type SongSource =
  | { type: 'ai'; mood: Mood; singer: Singer; version: number; lyrics: string }
  | {
      type: 'upload';
      fileName: string;
      /** Path in the Supabase `gift-uploads` bucket: `{userId}/...` */
      storagePath: string;
      durationSec: number;
      trimStartSec: number;
      fade: boolean;
    };

export type CreateGiftInput = {
  templateId: string;
  recipientName: string;
  senderName: string;
  funFact: string;
  /** Paths in the Supabase `gift-uploads` bucket (uploaded by the app first). */
  photoPaths: string[];
  /** null when the template has no song (photo templates, song mode 'none'). */
  song: SongSource | null;
};

export type GiftStatus =
  | 'queued'
  | 'writing_lyrics'
  | 'composing'
  | 'rendering'
  | 'preview_ready'
  | 'paid'
  | 'failed';

export type Gift = {
  id: string;
  templateId: string;
  occasion: Occasion;
  recipientName: string;
  senderName: string;
  status: GiftStatus;
  /** 0..1 */
  progress: number;
  createdAt: string;
  previewUrl: string | null;
  hdUrl: string | null;
  colors: readonly [string, string];
  templateName: string;
  price: number;
};

export type LibraryKind = 'video' | 'photo' | 'draft';

export type LibraryItem = {
  id: string;
  kind: LibraryKind;
  title: string;
  subtitle: string;
  status: 'hd' | 'preview' | 'making' | 'draft' | 'photo';
  progress: number;
  colors: readonly [string, string];
  giftId: string | null;
  createdAt: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
};
