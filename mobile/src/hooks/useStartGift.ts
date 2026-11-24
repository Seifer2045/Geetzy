import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { queryKeys, useCreateGift } from '@/api/hooks';
import type { Template } from '@/api/types';
import { uploadGiftFiles } from '@/api/upload';
import { newDraftId, useCreateFlow } from '@/store/createFlow';

/** Uploads the photos (and own song), sends the draft to the API and opens the Making screen. */
export const useStartGift = () => {
  const mutation = useCreateGift();
  const queryClient = useQueryClient();
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
      // Photo templates (and silent videos) have no song at all. The template is already cached by the details screen.
      const silent = queryClient.getQueryData<Template>(queryKeys.template(s.templateId))?.songMode === 'none';
      const ownSong = !silent && s.songSource === 'upload' && s.upload ? { uri: s.upload.uri, name: s.upload.name } : null;
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
        song: silent ? null : s.songPayload(files.songPath),
      });
      // The song now belongs to this gift; the next gift gets a new draft id (and its own song).
      s.set({ giftId: gift.id, songDraft: null, draftId: newDraftId() });
      router.push({ pathname: '/create/making', params: { giftId: gift.id } });
    } catch (e) {
      Alert.alert('Could not start', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return { start, isPending: uploading || mutation.isPending, uploading, uploadProgress };
};
