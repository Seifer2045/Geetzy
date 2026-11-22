import { Alert, KeyboardAvoidingView, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useTemplate } from '@/api/hooks';
import { useStartGift } from '@/hooks/useStartGift';
import { AppText, Badge, Button, Icon, Input, PressableScale, Screen, StickyFooter, STICKY_FOOTER_SPACE, TopBar } from '@/components';
import { useCreateFlow } from '@/store/createFlow';
import { colors, enterUp, exitUp, radius, screenPadding, stagger } from '@/theme';

export default function Details() {
  const flow = useCreateFlow();
  const { width } = useWindowDimensions();
  const slotW = (width - screenPadding * 2 - 20) / 3;
  const slot = { width: slotW, height: slotW * 1.2 };
  const { data: t } = useTemplate(flow.templateId ?? undefined);
  const { start, isPending, uploading, uploadProgress } = useStartGift();
  const noSong = t?.songMode === 'none';
  const min = t?.photosMin ?? 3;
  const max = t?.photosMax ?? 5;
  const canAdd = flow.photos.length < max;
  const ready = flow.photos.length >= min && flow.recipientName.trim().length > 1 && flow.senderName.trim().length > 1;

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photos needed', 'Allow photo access to add pictures to the video.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: max - flow.photos.length,
      quality: 0.8,
    });
    if (res.canceled) return;
    flow.addPhotos(
      res.assets.map((a, i) => ({ uri: a.uri, id: a.assetId ?? `${a.uri}-${Date.now()}-${i}` })),
      max,
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        glow="top"
        bottomInset={STICKY_FOOTER_SPACE}
        contentStyle={{ gap: 18 }}
        footer={
          <StickyFooter>
            {noSong ? (
              <Button
                label={uploading ? `Uploading photos… ${Math.round(uploadProgress * 100)}%` : 'Create'}
                loading={isPending && !uploading}
                disabled={!ready || isPending}
                onPress={start}
              />
            ) : (
              <Button label="Continue" disabled={!ready} onPress={() => router.push('/create/song')} />
            )}
          </StickyFooter>
        }
      >
        <TopBar title="Photos & details" step={2} />
        <View style={styles.pad}>
          <Animated.View entering={enterUp(stagger(0))} style={{ gap: 6 }}>
            <AppText variant="h2">Who’s it for?</AppText>
            <AppText variant="bodySm" color="muted">{`Add ${min}–${max} photos. The first one is the cover of the video.`}</AppText>
          </Animated.View>

          <Animated.View entering={enterUp(stagger(1))} style={styles.grid}>
            {flow.photos.map((p, i) => (
              <Animated.View key={p.id} entering={enterUp(0)} exiting={exitUp} layout={LinearTransition.duration(200)} style={[styles.photo, slot]}>
                <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                <PressableScale onPress={() => flow.removePhoto(p.id)} style={styles.remove} hitSlop={8} accessibilityLabel={`Remove photo ${i + 1}`}>
                  <Icon name="close" size={12} strokeWidth={2.4} />
                </PressableScale>
                {i === 0 ? (
                  <View style={styles.cover}>
                    <Badge label="COVER" />
                  </View>
                ) : null}
              </Animated.View>
            ))}
            {canAdd ? (
              <Animated.View layout={LinearTransition.duration(200)}>
                <PressableScale onPress={pick} style={[styles.photo, slot, styles.add]} accessibilityRole="button" accessibilityLabel="Add photos">
                  <Icon name="plus" size={22} color={colors.textSecondary} strokeWidth={2.2} />
                  <AppText variant="caption" color="textSecondary">
                    Add photo
                  </AppText>
                  <AppText variant="micro" color="faint" style={{ letterSpacing: 0 }}>{`${flow.photos.length}/${max}`}</AppText>
                </PressableScale>
              </Animated.View>
            ) : null}
          </Animated.View>

          <Animated.View entering={enterUp(stagger(2))} style={{ gap: 16 }}>
            <Input label="Their name" value={flow.recipientName} onChangeText={(v) => flow.set({ recipientName: v })} placeholder="Priya" autoCapitalize="words" maxLength={20} />
            <Input label="From" value={flow.senderName} onChangeText={(v) => flow.set({ senderName: v })} placeholder="Rahul" autoCapitalize="words" maxLength={20} />
            <Input
              label="Something fun about them"
              value={flow.funFact}
              onChangeText={(v) => flow.set({ funFact: v })}
              placeholder="Loves chai, always late"
              maxLength={40}
            />
            <View style={styles.tip}>
              <Icon name="sparkle" size={16} color={colors.gold} />
              <AppText variant="caption" color="muted">
                We use these words in the lyrics
              </AppText>
            </View>
          </Animated.View>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: screenPadding, gap: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photo: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceRaised },
  add: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.glassSoft,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  remove: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  cover: { position: 'absolute', left: 8, bottom: 8 },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
