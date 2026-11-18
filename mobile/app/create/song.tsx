import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import Animated from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { useLyrics } from '@/api/hooks';
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
import { colors, enterUp, exitUp, fonts, gradients, radius, screenPadding, stagger } from '@/theme';
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

/** Highlights the recipient's name inside the lyrics. */
const Lyrics = ({ text, name }: { text: string; name: string }) => {
  const parts = name ? text.split(new RegExp(`(${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g')) : [text];
  return (
    <AppText variant="body" style={{ fontSize: 14, lineHeight: 23 }}>
      {parts.map((p, i) =>
        p === name ? (
          <AppText key={i} variant="body" style={{ color: colors.pinkSoft, fontFamily: fonts.bold, fontSize: 14 }}>
            {p}
          </AppText>
        ) : (
          p
        ),
      )}
    </AppText>
  );
};

// ---------------------------------------------------------------- AI song panel
const AiSongPanel = () => {
  const flow = useCreateFlow();
  const [editing, setEditing] = useState(false);
  const name = flow.recipientName.trim() || 'Priya';

  const lyricsQuery = useLyrics(
    flow.templateId
      ? { templateId: flow.templateId, recipientName: name, funFact: flow.funFact.trim(), mood: flow.mood, singer: flow.singer, version: flow.version }
      : null,
  );
  const generating = lyricsQuery.isFetching;
  // flow.lyrics = what will be sung (the user may edit it). Copy in newly fetched lyrics, but keep the user's edits.
  const appliedAt = useRef(flow.lyrics !== null ? lyricsQuery.dataUpdatedAt : 0);
  useEffect(() => {
    const data = lyricsQuery.data;
    if (!data) return;
    if (lyricsQuery.dataUpdatedAt === appliedAt.current && useCreateFlow.getState().lyrics !== null) return;
    appliedAt.current = lyricsQuery.dataUpdatedAt;
    flow.set({ lyrics: data.lyrics });
  }, [lyricsQuery.data, lyricsQuery.dataUpdatedAt, flow.lyrics]); // eslint-disable-line react-hooks/exhaustive-deps
  const lyrics = flow.lyrics ?? '';
  const title = lyricsQuery.data?.title ?? songTitle(name, flow.occasion);

  // A new mood or version means new words. Singer only changes the voice, so keep the lyrics.
  const recompose = (patch: Parameters<typeof flow.set>[0]) => {
    setEditing(false);
    flow.set({ ...patch, lyrics: null });
  };

  const regenerate = async () => {
    if (flow.retriesLeft <= 0) {
      Alert.alert('No re-tries left', 'Pick one of the 3 versions, or change the mood.');
      return;
    }
    setEditing(false);
    flow.set({ retriesLeft: flow.retriesLeft - 1, lyrics: null });
    await lyricsQuery.refetch();
  };

  return (
    <Animated.View entering={enterUp(0)} exiting={exitUp} style={{ gap: 16 }}>
      {/* Player */}
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
          <PressableScale onPress={regenerate} disabled={generating} style={styles.regen} accessibilityRole="button" accessibilityLabel="Write new lyrics">
            <Icon name="refresh" size={18} />
          </PressableScale>
        </View>

        <View style={styles.generating}>
          {generating ? <Lottie name="equalizer" style={{ width: 72, height: 36 }} /> : <Icon name="music" size={18} color={colors.pinkSoft} />}
          <AppText variant="caption" color="textSecondary" style={{ flex: 1 }}>
            {generating
              ? 'Writing your lyrics…'
              : lyricsQuery.isError
                ? 'Could not write the lyrics. Tap ↻ to try again.'
                : 'We sing these words with your mood and singer. You’ll hear it in the preview.'}
          </AppText>
        </View>

        <View style={styles.versions}>
          {[1, 2, 3].map((v) => {
            const on = flow.version === v;
            return (
              <PressableScale key={v} haptic="selection" onPress={() => !on && recompose({ version: v })} style={[styles.version, on && styles.versionOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                <AppText variant="label" style={{ fontSize: 12, color: on ? colors.ink : colors.textSecondary }}>{`V${v}`}</AppText>
              </PressableScale>
            );
          })}
          <AppText variant="caption" color="muted" style={{ flex: 1, textAlign: 'right', fontSize: 11 }}>
            {`3 versions · ${flow.retriesLeft} re-tries left`}
          </AppText>
        </View>
      </View>

      {/* Lyrics */}
      <GlassCard tone="soft" rounded={radius.lg + 2} style={{ gap: 8 }}>
        <View style={styles.lyricsHead}>
          <AppText variant="overline" color="muted">
            Lyrics
          </AppText>
          <PressableScale
            onPress={() => {
              if (editing) flow.set({ lyrics });
              setEditing((e) => !e);
            }}
            style={styles.editBtn}
            hitSlop={8}
          >
            <Icon name={editing ? 'check' : 'edit'} size={14} color={colors.pinkSoft} />
            <AppText variant="label" color="pinkSoft" style={{ fontSize: 12 }}>
              {editing ? 'Done' : 'Edit lyrics'}
            </AppText>
          </PressableScale>
        </View>
        {editing ? (
          <TextInput
            value={lyrics}
            onChangeText={(v) => flow.set({ lyrics: v })}
            multiline
            style={styles.lyricsInput}
            selectionColor={colors.pink}
            accessibilityLabel="Edit lyrics"
          />
        ) : lyrics ? (
          <Lyrics text={lyrics} name={name} />
        ) : (
          <AppText variant="body" color="muted" style={{ fontSize: 14, lineHeight: 23 }}>
            {generating ? '…' : 'No lyrics yet.'}
          </AppText>
        )}
      </GlassCard>

      <View style={{ gap: 10 }}>
        <AppText variant="overline" color="muted">
          Mood
        </AppText>
        <View style={styles.wrap}>
          {MOODS.map((m) => (
            <Chip key={m.id} label={m.label} icon={m.icon} selected={flow.mood === m.id} onPress={() => flow.mood !== m.id && recompose({ mood: m.id })} />
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

  const isUpload = flow.songSource === 'upload';

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
              disabled={!flow.lyrics?.trim() || isPending}
              onPress={start}
            />
          )}
        </StickyFooter>
      }
    >
      <TopBar title="The song" step={3} />
      <View style={{ paddingHorizontal: screenPadding, gap: 16 }}>
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
        {isUpload ? <UploadPanel key="upload" /> : <AiSongPanel key="ai" />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  playerCard: { borderRadius: radius.xxl - 2, padding: 16, gap: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,77,141,0.35)' },
  playerShine: { position: 'absolute', width: 180, height: 180, borderRadius: 90, top: -80, right: -40, backgroundColor: 'rgba(255,77,141,0.18)' },
  playerHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  regen: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  playBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center', paddingLeft: 2 },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  generating: { height: 54, flexDirection: 'row', alignItems: 'center', gap: 12 },
  versions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  version: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border },
  versionOn: { backgroundColor: colors.text, borderColor: colors.text },
  lyricsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lyricsInput: { color: colors.text, fontFamily: fonts.medium, fontSize: 14, lineHeight: 23, minHeight: 100, textAlignVertical: 'top', padding: 0 },
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
