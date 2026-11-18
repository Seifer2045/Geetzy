import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useCreateGift } from '@/api/hooks';
import { uploadGiftFiles } from '@/api/upload';
import { useCreateFlow } from '@/store/createFlow';

/** Uploads the photos (and own song), sends the draft to the API and opens the Making screen. */
export const useStartGift = () => {
  const mutation = useCreateGift();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const start = async () => {
    const s = useCreateFlow.getState();
    if (!s.templateId) {
      Alert.alert('Pick a template first');
      return;
    }
    try {
      setUploading(true);
      setUploadProgress(0);
      const ownSong = s.songSource === 'upload' && s.upload ? { uri: s.upload.uri, name: s.upload.name } : null;
      const files = await uploadGiftFiles(
        s.photos.map((p) => p.uri),
        ownSong,
        (done, total) => setUploadProgress(done / total),
      );
      setUploading(false);

      const gift = await mutation.mutateAsync({
        templateId: s.templateId,
        recipientName: s.recipientName.trim(),
        senderName: s.senderName.trim(),
        funFact: s.funFact.trim(),
        photoPaths: files.photoPaths,
        song: s.songPayload(files.songPath),
      });
      s.set({ giftId: gift.id });
      router.push({ pathname: '/create/making', params: { giftId: gift.id } });
    } catch (e) {
      Alert.alert('Could not start', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return { start, isPending: uploading || mutation.isPending, uploading, uploadProgress };
};
