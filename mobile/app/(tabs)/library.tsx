import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';
import { useLibrary } from '@/api/hooks';
import type { LibraryItem } from '@/api/types';
import {
  AppText,
  Badge,
  Chip,
  GradientFill,
  Icon,
  IconButton,
  PlayGlyph,
  PressableScale,
  Screen,
  SectionHeader,
  TAB_BAR_SPACE,
} from '@/components';
import { colors, enterUp, gradients, radius, screenPadding, stagger } from '@/theme';

type Filter = 'all' | 'video' | 'photo' | 'draft';

const STATUS: Record<LibraryItem['status'], { label: string; tone: 'success' | 'gold' | 'pink' | 'light' | 'muted' }> = {
  hd: { label: 'HD', tone: 'success' },
  preview: { label: 'PREVIEW', tone: 'gold' },
  making: { label: 'MAKING', tone: 'pink' },
  photo: { label: 'PHOTO', tone: 'light' },
  draft: { label: 'DRAFT', tone: 'muted' },
};

const showActions = (item: LibraryItem) => {
  Alert.alert(item.title, item.subtitle, [
    { text: 'Share to WhatsApp', onPress: () => void Share.share({ message: `${item.title} — made with love 🎵` }) },
    { text: 'Rename' },
    { text: 'Delete', style: 'destructive' },
    { text: 'Cancel', style: 'cancel' },
  ]);
};

export default function Library() {
  const { width } = useWindowDimensions();
  const { data = [], isLoading, refetch, isRefetching } = useLibrary();
  const [filter, setFilter] = useState<Filter>('all');
  const cardW = (width - screenPadding * 2 - 12) / 2;

  const counts = useMemo(
    () => ({
      all: data.length,
      video: data.filter((d) => d.kind === 'video').length,
      photo: data.filter((d) => d.kind === 'photo').length,
      draft: data.filter((d) => d.kind === 'draft').length,
    }),
    [data],
  );
  const items = filter === 'all' ? data : data.filter((d) => d.kind === filter);
  const waiting = data.find((d) => d.status === 'preview');

  const openItem = (item: LibraryItem) => {
    if (item.status === 'making' && item.giftId) router.push({ pathname: '/create/making', params: { giftId: item.giftId } });
    else if (item.giftId) router.push({ pathname: '/create/preview', params: { giftId: item.giftId } });
    else if (item.kind === 'draft') router.push('/create/templates');
  };

  return (
    <Screen
      glow="top"
      bottomInset={TAB_BAR_SPACE}
      contentStyle={{ gap: 18 }}
      scrollProps={{ refreshControl: <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.pink} /> }}
    >
      <Animated.View entering={enterUp(stagger(0))} style={styles.header}>
        <AppText variant="h1" style={{ flex: 1 }}>
          Library
        </AppText>
        <IconButton icon="search" label="Search library" />
        <IconButton icon="filter" label="Sort" />
      </Animated.View>

      <Animated.View entering={enterUp(stagger(1))}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
          <Chip label="All" count={counts.all} selected={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label="Videos" count={counts.video} selected={filter === 'video'} onPress={() => setFilter('video')} />
          <Chip label="Photos" count={counts.photo} selected={filter === 'photo'} onPress={() => setFilter('photo')} />
          <Chip label="Drafts" count={counts.draft} selected={filter === 'draft'} onPress={() => setFilter('draft')} />
        </ScrollView>
      </Animated.View>

      {waiting ? (
        <Animated.View entering={enterUp(stagger(2))} style={{ paddingHorizontal: screenPadding }}>
          <PressableScale onPress={() => openItem(waiting)} style={styles.banner} accessibilityRole="button" accessibilityLabel="Unlock HD video">
            <Icon name="lock" size={20} color={colors.gold} />
            <View style={{ flex: 1 }}>
              <AppText variant="label">1 video waiting in preview</AppText>
              <AppText variant="caption" color="muted" style={{ fontFamily: 'Inter_400Regular', fontSize: 11 }}>
                Unlock HD & remove watermark
              </AppText>
            </View>
            <View style={styles.unlock}>
              <AppText variant="label" style={{ color: colors.goldInk, fontFamily: 'Inter_700Bold', fontSize: 12 }}>
                ₹49
              </AppText>
            </View>
          </PressableScale>
        </Animated.View>
      ) : null}

      <View style={{ gap: 12 }}>
        <SectionHeader title="Recent" />
        {isLoading ? (
          <ActivityIndicator color={colors.pink} style={{ marginTop: 24 }} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="library" size={32} color={colors.faint} />
            <AppText variant="bodySm" color="muted" align="center">
              Nothing here yet. Tap ＋ to make your first gift.
            </AppText>
          </View>
        ) : (
          <View style={styles.grid}>
            {items.map((item, i) => (
              <Animated.View key={item.id} entering={enterUp(i * 60)} style={{ width: cardW, gap: 8 }}>
                <PressableScale onPress={() => openItem(item)} accessibilityRole="button" accessibilityLabel={`${item.title}, ${STATUS[item.status].label}`}>
                  <View style={[styles.thumb, { height: item.kind === 'photo' ? cardW : cardW * 1.43 }]}>
                    <LinearGradient colors={item.colors} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
                    <LinearGradient colors={gradients.thumbShade} start={{ x: 0, y: 0.5 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
                    {item.status === 'preview' ? (
                      <AppText variant="h3" style={styles.watermark}>
                        PREVIEW
                      </AppText>
                    ) : null}
                    <View style={styles.thumbTop}>
                      <Badge label={item.status === 'making' ? `MAKING ${Math.round(item.progress * 100)}%` : STATUS[item.status].label} tone={STATUS[item.status].tone} />
                      <IconButton label="More actions" size={28} tone="dark" onPress={() => showActions(item)}>
                        <Icon name="more" size={14} />
                      </IconButton>
                    </View>
                    <View style={styles.thumbBottom}>
                      {item.status === 'making' ? (
                        <View style={styles.track}>
                          <GradientFill style={{ height: 4, borderRadius: 2, width: `${Math.round(item.progress * 100)}%` }} />
                        </View>
                      ) : item.kind === 'photo' ? (
                        <Icon name="image" size={16} />
                      ) : (
                        <>
                          <View style={styles.play}>
                            <PlayGlyph size={12} />
                          </View>
                          <AppText variant="micro">0:15</AppText>
                        </>
                      )}
                    </View>
                  </View>
                </PressableScale>
                <View>
                  <AppText variant="label" numberOfLines={1}>
                    {item.title}
                  </AppText>
                  <AppText variant="caption" color="muted" numberOfLines={1} style={{ fontSize: 11 }}>
                    {item.subtitle}
                  </AppText>
                </View>
              </Animated.View>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: screenPadding },
  hRow: { paddingHorizontal: screenPadding, gap: 8 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,200,87,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,200,87,0.35)',
  },
  unlock: { backgroundColor: colors.gold, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: screenPadding },
  thumb: { borderRadius: radius.lg + 2, overflow: 'hidden', padding: 10, justifyContent: 'space-between' },
  thumbTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  thumbBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  watermark: { position: 'absolute', alignSelf: 'center', top: '45%', opacity: 0.2, letterSpacing: 2, transform: [{ rotate: '-25deg' }] },
  play: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', paddingLeft: 2 },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 40 },
});
