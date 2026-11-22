import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import Animated from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTemplate } from '@/api/hooks';
import { recentDeviceAudio as sampleDeviceAudio } from '@/api/mockData';
import {
  AppText,
  Button,
  Chip,
  GlassCard,
  GradientFill,
  Icon,
  Lottie,
  PressableScale,
  Screen,
  Segmented,
  StickyFooter,
  STICKY_FOOTER_SPACE,
  TopBar,
} from '@/components';
import { env } from '@/config/env';
import { MOODS, SINGERS } from '@/constants/catalog';
import { useStartGift } from '@/hooks/useStartGift';
import { useCreateFlow } from '@/store/createFlow';
import { colors, enterUp, exitUp, gradients, radius, screenPadding, stagger } from '@/theme';
import { formatTime } from '@/utils/format';
import { songTitle } from '@/utils/lyrics';

const MAX_MB = 20;

// ---------------------------------------------------------------- shared bits
const Cover = ({ size, colors: c }: { size: number; colors: readonly [string, string, ...string[]] }) => (
  <GradientFill colors={c} vertical style={{ width: size, height: size, borderRadius: size * 0.25, alignItems: 'center', justifyContent: 'center' }}>
    <Icon name="music" size={size * 0.42} strokeWidth={2} />
  </GradientFill>
);

const Checkbox = ({ checked }: { checked: boolean }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    {checked ? (
      <>
        <Rect x="2" y="2" width="20" height="20" rx="6" fill={colors.pink} />
        <Path d="M7 12.5l3 3 7-7" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    ) : (
      <Rect x="3" y="3" width="18" height="18" rx="5.5" stroke="#5A4A80" strokeWidth={2} fill="none" />
    )}
  </Svg>
);

const Radio = ({ on }: { on: boolean }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24">
    {on ? (
      <>
        <Rect x="2" y="2" width="20" height="20" rx="10" fill={colors.pink} />
        <Path d="M7.5 12.5l3 3 6-6.5" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    ) : (
      <Rect x="2.5" y="2.5" width="19" height="19" rx="9.5" stroke="#5A4A80" strokeWidth={2} fill="none" />
    )}
  </Svg>
);

// ---------------------------------------------------------------- AI song panel
// The song is made once, after "Use this song", from the template's audio prompt + your names, mood and singer.
const AiSongPanel = () => {
  const flow = useCreateFlow();
  const name = flow.recipientName.trim() || 'Priya';
  const title = songTitle(name, flow.occasion);

  return (
    <Animated.View entering={enterUp(0)} exiting={exitUp} style={{ gap: 16 }}>
      <View style={styles.playerCard}>
        <GradientFill colors={gradients.player} style={StyleSheet.absoluteFill} />
        <View style={styles.playerShine} />
        <View style={styles.playerHead}>
          <Cover size={56} colors={gradients.brand} />
          <View style={{ flex: 1 }}>
            <AppText variant="label" style={{ fontSize: 15 }} numberOfLines={1}>
              {title}
            </AppText>
            <AppText variant="caption" color="muted">
              {`${MOODS.find((m) => m.id === flow.mood)?.label} · ${SINGERS.find((s) => s.id === flow.singer)?.label} · 0:15`}
            </AppText>
          </View>
        </View>
        <View style={styles.generating}>
          <Icon name="music" size={18} color={colors.pinkSoft} />
          <AppText variant="caption" color="textSecondary" style={{ flex: 1 }}>
            {`We make a 15-second song for ${name} with your mood and singer. You’ll hear it in the preview.`}
          </AppText>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <AppText variant="overline" color="muted">
          Mood
        </AppText>
        <View style={styles.wrap}>
          {MOODS.map((m) => (
            <Chip key={m.id} label={m.label} icon={m.icon} selected={flow.mood === m.id} onPress={() => flow.set({ mood: m.id })} />
          ))}
        </View>
      </View>
      <View style={{ gap: 10 }}>
        <AppText variant="overline" color="muted">
          Singer
        </AppText>
        <View style={styles.wrap}>
          {SINGERS.map((s) => (
            <Chip key={s.id} label={s.label} selected={flow.singer === s.id} onPress={() => flow.set({ singer: s.id })} />
          ))}
        </View>
      </View>
    </Animated.View>
  );
};

// ---------------------------------------------------------------- Upload panel
// Sample files only exist in mock mode; real users pick a file with Browse.
const recentDeviceAudio = env.useMock ? sampleDeviceAudio : [];

const UploadPanel = () => {
  const flow = useCreateFlow();

  const browse = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true, multiple: false });
    if (res.canceled) return;
    const file = res.assets[0];
    if (!file) return;
    if ((file.size ?? 0) > MAX_MB * 1024 * 1024) {
      Alert.alert('File too large', `Please choose a song under ${MAX_MB} MB.`);
      return;
    }
    // Real duration comes from the server (ffprobe) after upload; assume 3 min for the trimmer now.
    flow.set({ upload: { name: file.name, uri: file.uri, durationSec: 180 }, trimStartSec: 0 });
  };

  return (
    <Animated.View entering={enterUp(0)} exiting={exitUp} style={{ gap: 16 }}>
      <View style={styles.dropzone}>
        <GradientFill style={styles.uploadIcon}>
          <Icon name="upload" size={24} strokeWidth={2.2} />
        </GradientFill>
        <AppText variant="label" style={{ fontSize: 15, marginTop: 4 }}>
          Choose a song from your phone
        </AppText>
        <AppText variant="caption" color="muted" style={{ fontFamily: 'Inter_400Regular' }}>
          {`MP3, M4A, WAV, AAC · up to ${MAX_MB} MB`}
        </AppText>
        <Button variant="glass" label="Browse files" onPress={browse} style={{ marginTop: 8 }} />
        <PressableScale onPress={() => Alert.alert('Coming soon', 'Voice messages will be available in the next update.')} style={styles.record}>
          <Icon name="mic" size={15} color={colors.pinkSoft} />
          <AppText variant="label" color="pinkSoft" style={{ fontSize: 12 }}>
            or record a voice message
          </AppText>
        </PressableScale>
      </View>

      {flow.upload || recentDeviceAudio.length > 0 ? (
      <>
      <View style={styles.listHead}>
        <AppText variant="title" style={{ fontSize: 15 }}>
          {flow.upload && !recentDeviceAudio.some((a) => a.name === flow.upload?.name) ? 'Selected' : 'Recent on this phone'}
        </AppText>
      </View>
      <GlassCard tone="soft" padding={4} rounded={radius.lg + 2}>
        {flow.upload && !recentDeviceAudio.some((a) => a.name === flow.upload?.name) ? (
          <View style={[styles.fileRow, styles.fileOn]}>
            <Cover size={40} colors={gradients.hero} />
            <View style={{ flex: 1 }}>
              <AppText variant="body" numberOfLines={1}>
                {flow.upload.name}
              </AppText>
              <AppText variant="caption" color="muted">
                From your files
              </AppText>
            </View>
            <Radio on />
          </View>
        ) : null}
        {recentDeviceAudio.map((a) => {
          const on = flow.upload?.name === a.name;
          return (
            <PressableScale
              key={a.id}
              scaleTo={0.99}
              haptic="selection"
              onPress={() => flow.set({ upload: { name: a.name, uri: `mock://${a.id}`, durationSec: a.durationSec }, trimStartSec: 0 })}
              style={[styles.fileRow, on && styles.fileOn]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <Cover size={40} colors={a.colors} />
              <View style={{ flex: 1 }}>
                <AppText variant="body" numberOfLines={1}>
                  {a.name}
                </AppText>
                <AppText variant="caption" color="muted" style={{ fontFamily: 'Inter_400Regular' }}>
                  {`${formatTime(a.durationSec)} · ${a.sizeMb} MB`}
                </AppText>
              </View>
              <Radio on={on} />
            </PressableScale>
          );
        })}
      </GlassCard>
      </>
      ) : null}
    </Animated.View>
  );
};

// ---------------------------------------------------------------- Screen
export default function Song() {
  const flow = useCreateFlow();
  const { start, isPending, uploading, uploadProgress } = useStartGift();

  const { data: tpl } = useTemplate(flow.templateId ?? undefined);
  const mode = tpl?.songMode ?? 'both';
  // A template can allow only an AI song or only the user's own song.
  const isUpload = mode === 'upload' || (mode !== 'ai' && flow.songSource === 'upload');

  return (
    <Screen
      glow="violet"
      bottomInset={STICKY_FOOTER_SPACE + (isUpload ? 40 : 0)}
      contentStyle={{ gap: 16 }}
      footer={
        <StickyFooter>
          {isUpload ? (
            <>
              <PressableScale onPress={() => flow.set({ rightsConfirmed: !flow.rightsConfirmed })} style={styles.rights} scaleTo={0.99} accessibilityRole="checkbox" accessibilityState={{ checked: flow.rightsConfirmed }}>
                <Checkbox checked={flow.rightsConfirmed} />
                <AppText variant="caption" color="textSecondary" style={{ flex: 1 }}>
                  I own this song or have permission to use it.
                </AppText>
              </PressableScale>
              <Button label="Next: trim song" disabled={!flow.upload || !flow.rightsConfirmed} onPress={() => router.push('/create/trim')} />
            </>
          ) : (
            <Button
              label={uploading ? `Uploading photos… ${Math.round(uploadProgress * 100)}%` : 'Use this song'}
              loading={isPending && !uploading}
              disabled={isPending}
              onPress={start}
            />
          )}
        </StickyFooter>
      }
    >
      <TopBar title="The song" step={3} />
      <View style={{ paddingHorizontal: screenPadding, gap: 16 }}>
        {mode === 'both' ? (
        <Animated.View entering={enterUp(stagger(0))}>
          <Segmented
            value={flow.songSource}
            onChange={(v) => flow.set({ songSource: v })}
            options={[
              { value: 'ai', label: 'AI song', icon: 'sparkle' },
              { value: 'upload', label: 'My song', icon: 'upload' },
            ]}
          />
        </Animated.View>
        ) : null}
        {isUpload ? <UploadPanel key="upload" /> : <AiSongPanel key="ai" />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  playerCard: { borderRadius: radius.xxl - 2, padding: 16, gap: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,77,141,0.35)' },
  playerShine: { position: 'absolute', width: 180, height: 180, borderRadius: 90, top: -80, right: -40, backgroundColor: 'rgba(255,77,141,0.18)' },
  playerHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  playBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center', paddingLeft: 2 },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  generating: { height: 54, flexDirection: 'row', alignItems: 'center', gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dropzone: {
    alignItems: 'center',
    gap: 6,
    padding: 20,
    paddingTop: 22,
    borderRadius: radius.xxl - 2,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,122,168,0.55)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  uploadIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  record: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  listHead: { flexDirection: 'row', justifyContent: 'space-between' },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14 },
  fileOn: { backgroundColor: 'rgba(255,77,141,0.10)' },
  rights: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
