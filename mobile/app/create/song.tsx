import { useState, type ReactNode } from 'react';
import { Alert, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import Animated from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { useMakeSongDraft, useTemplate } from '@/api/hooks';
import type { Trait } from '@/api/types';
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
  SongPlayer,
  StickyFooter,
  STICKY_FOOTER_SPACE,
  TopBar,
} from '@/components';
import { env } from '@/config/env';
import { LANGUAGES, MAX_IDEA, MAX_TRAITS, MOODS, MUSIC_STYLES, RELATIONSHIPS, SINGERS, TRAITS } from '@/constants/catalog';
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

// ---------------------------------------------------------------- AI song panel
// ONE personal song per video: the user picks the details, presses "Make my song", listens, and the SAME song goes into the video.
const Section = ({ title, hint, right, children }: { title: string; hint?: string; right?: string; children: ReactNode }) => (
  <GlassCard tone="soft" padding={16} style={{ gap: 12 }}>
    <View style={styles.sectionHead}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="label" style={{ fontSize: 14 }}>
          {title}
        </AppText>
        {hint ? (
          <AppText variant="caption" color="muted">
            {hint}
          </AppText>
        ) : null}
      </View>
      {right ? (
        <AppText variant="caption" color="muted">
          {right}
        </AppText>
      ) : null}
    </View>
    {children}
  </GlassCard>
);

type PanelProps = { making: boolean; error: string };

const AiSongPanel = ({ making, error }: PanelProps) => {
  const flow = useCreateFlow();
  const { width } = useWindowDimensions();
  const name = flow.recipientName.trim() || 'them';
  const title = songTitle(flow.recipientName.trim() || 'Priya', flow.occasion);
  const locked = flow.songDraft !== null;
  const traitsFull = flow.traits.length >= MAX_TRAITS;

  const toggleTrait = (t: Trait) => {
    if (flow.traits.includes(t)) flow.set({ traits: flow.traits.filter((x) => x !== t) });
    else if (!traitsFull) flow.set({ traits: [...flow.traits, t] });
  };

  return (
    <Animated.View entering={enterUp(0)} exiting={exitUp} style={{ gap: 14 }}>
      {/* Player card: what is happening with the song right now */}
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
              {`${LANGUAGES.find((l) => l.id === flow.language)?.label} · ${MOODS.find((m) => m.id === flow.mood)?.label} · ${SINGERS.find((x) => x.id === flow.singer)?.label} · 0:15`}
            </AppText>
          </View>
        </View>
        {flow.songDraft ? (
          <>
            <SongPlayer uri={flow.songDraft.audioUrl} durationSec={flow.songDraft.durationSec} width={width - screenPadding * 2 - 34} />
            <View style={styles.generating}>
              <Icon name="check" size={18} color={colors.success} />
              <AppText variant="caption" color="textSecondary" style={{ flex: 1 }}>
                Your song is ready. This is the song your video will use. One song per video.
              </AppText>
            </View>
          </>
        ) : making ? (
          <View style={styles.generating}>
            <Lottie name="equalizer" style={{ width: 44, height: 44 }} />
            <AppText variant="caption" color="textSecondary" style={{ flex: 1 }}>
              {`Writing and singing a song for ${name}… about 30 seconds.`}
            </AppText>
          </View>
        ) : (
          <View style={styles.generating}>
            <Icon name="music" size={18} color={colors.pinkSoft} />
            <AppText variant="caption" color="textSecondary" style={{ flex: 1 }}>
              Pick the details below, then press “Make my song”. You can listen before the video is made.
            </AppText>
          </View>
        )}
        {error ? (
          <AppText variant="caption" style={{ color: colors.danger }} accessibilityRole="alert">
            {error}
          </AppText>
        ) : null}
      </View>

      {/* Details from the earlier screen */}
      <Section title="Song details" hint="From the details you entered. We use them in the lyrics.">
        <View style={{ gap: 6 }}>
          <AppText variant="body">{`For ${flow.recipientName.trim() || '—'}  ·  from ${flow.senderName.trim() || '—'}`}</AppText>
          <AppText variant="caption" color="muted">
            {flow.funFact.trim() ? `Fun fact: ${flow.funFact.trim()}` : 'No fun fact added'}
          </AppText>
        </View>
        {!locked ? <Button variant="glass" label="Edit details" onPress={() => router.back()} /> : null}
      </Section>

      <View style={{ gap: 14, opacity: locked ? 0.5 : 1 }} pointerEvents={locked ? 'none' : 'auto'}>
        <Section title={`Who is ${name} to you?`}>
          <View style={styles.wrap}>
            {RELATIONSHIPS.map((r) => (
              <Chip key={r.id} label={r.label} selected={flow.relationship === r.id} onPress={() => flow.set({ relationship: flow.relationship === r.id ? null : r.id })} />
            ))}
          </View>
        </Section>

        <Section title={`What is ${name} like?`} hint={`Pick up to ${MAX_TRAITS}`} right={`${flow.traits.length}/${MAX_TRAITS}`}>
          <View style={styles.wrap}>
            {TRAITS.map((t) => (
              <Chip key={t.id} label={t.label} selected={flow.traits.includes(t.id)} onPress={() => toggleTrait(t.id)} />
            ))}
          </View>
        </Section>

        <Section title="Language">
          <View style={styles.wrap}>
            {LANGUAGES.map((l) => (
              <Chip key={l.id} label={l.label} selected={flow.language === l.id} onPress={() => flow.set({ language: l.id })} />
            ))}
          </View>
        </Section>

        <Section title="Music style" hint="Leave empty to use the template’s own style">
          <View style={styles.wrap}>
            {MUSIC_STYLES.map((m) => (
              <Chip key={m.id} label={m.label} selected={flow.musicStyle === m.id} onPress={() => flow.set({ musicStyle: flow.musicStyle === m.id ? null : m.id })} />
            ))}
          </View>
        </Section>

        <Section title="Mood">
          <View style={styles.wrap}>
            {MOODS.map((m) => (
              <Chip key={m.id} label={m.label} icon={m.icon} selected={flow.mood === m.id} onPress={() => flow.set({ mood: m.id })} />
            ))}
          </View>
        </Section>

        <Section title="Singer">
          <View style={styles.wrap}>
            {SINGERS.map((x) => (
              <Chip key={x.id} label={x.label} selected={flow.singer === x.id} onPress={() => flow.set({ singer: x.id })} />
            ))}
          </View>
        </Section>

        <Section title="Your own idea (optional)" hint="Example: make it funny and mention our Goa trip" right={`${flow.idea.length}/${MAX_IDEA}`}>
          <View style={styles.ideaField}>
            <TextInput
              value={flow.idea}
              onChangeText={(v) => flow.set({ idea: v })}
              placeholder="Tell us anything special for the song"
              placeholderTextColor={colors.faint}
              selectionColor={colors.pink}
              multiline
              maxLength={MAX_IDEA}
              style={styles.ideaInput}
              accessibilityLabel="Your own idea for the song"
            />
          </View>
          <AppText variant="caption" color="muted">
            Please do not use singer, song or film names.
          </AppText>
        </Section>
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
  const makeSong = useMakeSongDraft();
  const [songError, setSongError] = useState('');

  const onMakeSong = () => {
    if (!flow.templateId) {
      Alert.alert('Pick a template first');
      return;
    }
    setSongError('');
    makeSong.mutate(
      {
        draftId: flow.draftId,
        templateId: flow.templateId,
        recipientName: flow.recipientName.trim(),
        senderName: flow.senderName.trim(),
        funFact: flow.funFact.trim(),
        mood: flow.mood,
        singer: flow.singer,
        prefs: { language: flow.language, musicStyle: flow.musicStyle, relationship: flow.relationship, traits: flow.traits, idea: flow.idea.trim() },
      },
      {
        onSuccess: (draft) => flow.set({ songDraft: draft }),
        onError: (e) => setSongError(e instanceof Error ? e.message : 'We could not make the song. Please try again.'),
      },
    );
  };
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
          ) : !flow.songDraft ? (
            <Button label="Make my song" loading={makeSong.isPending} disabled={makeSong.isPending} onPress={onMakeSong} />
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
        {isUpload ? <UploadPanel key="upload" /> : <AiSongPanel key="ai" making={makeSong.isPending} error={songError} />}
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
  sectionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  ideaField: {
    minHeight: 88,
    borderRadius: radius.lg - 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ideaInput: { color: colors.text, fontFamily: fonts.medium, fontSize: 15, minHeight: 64, textAlignVertical: 'top', padding: 0 },
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
