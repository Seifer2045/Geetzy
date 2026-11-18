import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { getSupabase } from '@/auth/supabase';
import { env } from '@/config/env';

const BUCKET = 'gift-uploads';
const MAX_SIDE = 1440;

const randomId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const extensionOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? 'mp3';

const AUDIO_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/x-m4a',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
};

/** Smaller photos upload faster on mobile data; the video is 1080 px wide anyway. HEIC becomes JPEG. */
const shrinkPhoto = async (uri: string): Promise<string> => {
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const tooBig = Math.max(original.width, original.height) > MAX_SIDE;
  const image = tooBig
    ? await ImageManipulator.manipulate(uri)
        .resize(original.width >= original.height ? { width: MAX_SIDE } : { height: MAX_SIDE })
        .renderAsync()
    : original;
  const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return saved.uri;
};

const currentUserId = async (): Promise<string> => {
  const { data } = await getSupabase().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Please sign in again.');
  return id;
};

const uploadFile = async (localUri: string, path: string, contentType: string) => {
  const bytes = await new File(localUri).arrayBuffer();
  const { error } = await getSupabase().storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
};

export type UploadResult = { photoPaths: string[]; songPath?: string };

/**
 * Uploads the gift's photos (and own song) to Supabase Storage under `{userId}/`.
 * Mock mode: nothing is uploaded, the local uris are passed through.
 */
export const uploadGiftFiles = async (
  photoUris: string[],
  song: { uri: string; name: string } | null,
  onProgress?: (done: number, total: number) => void,
): Promise<UploadResult> => {
  if (env.useMock || !env.realAuth) return { photoPaths: photoUris, songPath: song?.uri };

  const userId = await currentUserId();
  const batch = randomId();
  const total = photoUris.length + (song ? 1 : 0);
  let done = 0;
  const tick = () => onProgress?.(++done, total);

  const photoPaths = await Promise.all(
    photoUris.map(async (uri, i) => {
      const small = await shrinkPhoto(uri);
      const path = await uploadFile(small, `${userId}/${batch}/photo-${i + 1}.jpg`, 'image/jpeg');
      tick();
      return path;
    }),
  );

  let songPath: string | undefined;
  if (song) {
    const ext = extensionOf(song.name);
    songPath = await uploadFile(song.uri, `${userId}/${batch}/song.${ext}`, AUDIO_TYPES[ext] ?? 'audio/mpeg');
    tick();
  }
  return { photoPaths, songPath };
};
