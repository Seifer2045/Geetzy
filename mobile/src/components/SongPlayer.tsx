import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useEvent } from 'expo';
import { useVideoPlayer } from 'expo-video';
import { colors } from '@/theme';
import { AppText } from './AppText';
import { PauseGlyph, PlayGlyph } from './Icon';
import { PressableScale } from './PressableScale';
import { makePeaks, Waveform } from './Waveform';

type Props = { uri: string; durationSec: number; width: number };

/** Plays one short song from a URL (expo-video as an audio player, so no extra native module). */
export const SongPlayer = ({ uri, durationSec, width }: Props) => {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.2;
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const time = useEvent(player, 'timeUpdate', { currentTime: 0, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });
  const peaks = useMemo(() => makePeaks(44, 3), []);
  const total = player.duration > 0 ? player.duration : durationSec;
  const current = Math.min(time.currentTime, total);
  const done = total > 0 && current >= total - 0.3;

  const toggle = () => {
    if (isPlaying) {
      player.pause();
      return;
    }
    if (done) player.currentTime = 0;
    player.play();
  };

  const mmss = (s: number) => `0:${String(Math.floor(s)).padStart(2, '0')}`;

  return (
    <View style={styles.row}>
      <PressableScale
        onPress={toggle}
        style={styles.btn}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause your song' : 'Play your song'}
      >
        {isPlaying ? <PauseGlyph size={18} color={colors.bg} /> : <PlayGlyph size={18} color={colors.bg} />}
      </PressableScale>
      <View style={{ flex: 1, gap: 4 }}>
        <Waveform width={width - 44 - 12} height={34} peaks={peaks} progress={total > 0 ? current / total : 0} />
        <View style={styles.times}>
          <AppText variant="micro" color="muted">
            {mmss(current)}
          </AppText>
          <AppText variant="micro" color="muted">
            {mmss(total)}
          </AppText>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  btn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
});
