import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEvent } from 'expo';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTemplate } from '@/api/hooks';
import type { Template } from '@/api/types';
import { AppText, Button, IconButton, PlayGlyph, PressableScale } from '@/components';
import { colors, screenPadding } from '@/theme';

/** "0:07" style time label. */
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/** Full-screen sample video of a template. Tap to pause / play, loops, plays with sound. */
const TemplateVideo = ({ uri, fallbackSec }: { uri: string; fallbackSec: number }) => {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.timeUpdateEventInterval = 0.25;
    p.play();
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { currentTime } = useEvent(player, 'timeUpdate', {
    currentTime: player.currentTime,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });
  const duration = player.duration > 0 ? player.duration : fallbackSec;
  const progress = Math.min(1, Math.max(0, currentTime / duration));

  if (status === 'error') {
    return <Message text="Could not play this preview. Please check your internet and try again." onRetry={() => player.replace(uri)} />;
  }

  return (
    <>
      <PressableScale
        onPress={() => (isPlaying ? player.pause() : player.play())}
        style={StyleSheet.absoluteFill}
        scaleTo={1}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause preview' : 'Play preview'}
      >
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
        {status !== 'readyToPlay' ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.pink} size="large" />
          </View>
        ) : !isPlaying ? (
          <View style={styles.center}>
            <View style={styles.play}>
              <PlayGlyph size={26} />
            </View>
          </View>
        ) : null}
      </PressableScale>
      <Progress progress={progress} current={currentTime} total={duration} />
    </>
  );
};

const Progress = ({ progress, current, total }: { progress: number; current: number; total: number }) => {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="none" style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFill} />
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
      <AppText variant="micro" color="muted">{`${clock(current)} / ${clock(total)}`}</AppText>
    </View>
  );
};

const Message = ({ text, onRetry }: { text: string; onRetry?: () => void }) => (
  <View style={[styles.center, { paddingHorizontal: screenPadding * 2, gap: 16 }]}>
    <AppText variant="body" align="center" color="muted">
      {text}
    </AppText>
    {onRetry ? <Button label="Try again" variant="glass" onPress={onRetry} /> : null}
  </View>
);

const Body = ({ t }: { t: Template }) => {
  const url = t.previewUrl?.startsWith('http') ? t.previewUrl : null; // mock data has no real file
  if (!url) {
    return (
      <>
        <LinearGradient colors={t.colors} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
        {t.thumbUrl ? <Image source={{ uri: t.thumbUrl }} contentFit="contain" style={StyleSheet.absoluteFill} /> : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} />
        <Message text="The sample preview for this template is not ready yet." />
      </>
    );
  }
  if (t.previewType === 'image') {
    return <Image source={{ uri: url }} contentFit="contain" style={StyleSheet.absoluteFill} accessibilityLabel={`${t.name} sample`} />;
  }
  return <TemplateVideo uri={url} fallbackSec={t.durationSec} />;
};

export default function WatchTemplate() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: t, isLoading } = useTemplate(id);
  const [ready, setReady] = useState(false);

  // Mount the player after the open animation so the transition stays smooth.
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 120);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      {isLoading || !ready ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.pink} size="large" />
        </View>
      ) : t ? (
        <Body t={t} />
      ) : (
        <Message text="This template could not be found." />
      )}
      <View style={[styles.top, { top: insets.top + 12 }]}>
        <IconButton icon="close" label="Close preview" size={40} tone="dark" onPress={() => router.back()} />
        {t ? (
          <AppText variant="label" numberOfLines={1} style={{ flex: 1 }}>
            {t.name}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', left: screenPadding, right: screenPadding, flexDirection: 'row', alignItems: 'center', gap: 12 },
  play: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
  },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: screenPadding, paddingTop: 40, gap: 8 },
  track: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  fill: { height: 3, borderRadius: 2, backgroundColor: colors.text },
});
