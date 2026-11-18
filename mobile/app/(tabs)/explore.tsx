import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';
import { useTemplates } from '@/api/hooks';
import type { Occasion, Template, TemplateStyle } from '@/api/types';
import {
  AppText,
  Chip,
  DiyaArt,
  GradientFill,
  Icon,
  IconButton,
  PressableScale,
  Screen,
  SectionHeader,
  TAB_BAR_SPACE,
  TemplateCard,
} from '@/components';
import { OCCASIONS, STYLES } from '@/constants/catalog';
import { colors, enterUp, fonts, gradients, radius, screenPadding, stagger } from '@/theme';

export default function Explore() {
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [occasion, setOccasion] = useState<Occasion | undefined>();
  const [style, setStyle] = useState<TemplateStyle | undefined>();
  const { data = [], isLoading } = useTemplates({ occasion, style, q: query || undefined });
  const cardW = (width - screenPadding * 2 - 12) / 2;

  const top = useMemo(() => [...data].sort((a, b) => b.madeCount - a.madeCount), [data]);
  const open = (t: Template) => router.push({ pathname: '/create/template/[id]', params: { id: t.id } });

  return (
    <Screen glow="violet" bottomInset={TAB_BAR_SPACE} contentStyle={{ gap: 18 }}>
      <Animated.View entering={enterUp(stagger(0))} style={styles.header}>
        <AppText variant="h1" style={{ flex: 1 }}>
          Explore
        </AppText>
        <IconButton icon="filter" label="Filters" />
      </Animated.View>

      <Animated.View entering={enterUp(stagger(1))} style={{ paddingHorizontal: screenPadding }}>
        <View style={styles.search}>
          <Icon name="search" size={18} color={colors.faint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search templates, songs, moods"
            placeholderTextColor={colors.faint}
            selectionColor={colors.pink}
            style={styles.searchInput}
            accessibilityLabel="Search templates"
            returnKeyType="search"
          />
          <Icon name="mic" size={18} color={colors.textSecondary} />
        </View>
      </Animated.View>

      <Animated.View entering={enterUp(stagger(1))}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
          <Chip label="All" selected={!occasion} onPress={() => setOccasion(undefined)} />
          {OCCASIONS.filter((o) => !o.soon).map((o) => (
            <Chip key={o.id} label={o.label} selected={occasion === o.id} onPress={() => setOccasion(occasion === o.id ? undefined : o.id)} />
          ))}
        </ScrollView>
      </Animated.View>

      {!query ? (
        <Animated.View entering={enterUp(stagger(2))} style={{ paddingHorizontal: screenPadding }}>
          <PressableScale onPress={() => setOccasion('anniversary')} accessibilityRole="button" accessibilityLabel="Shaadi Season collection">
            <GradientFill colors={gradients.collection} style={styles.featured}>
              <View style={styles.diya}>
                <DiyaArt size={150} />
              </View>
              <View style={styles.collectionBadge}>
                <AppText variant="micro" style={{ color: colors.goldInk, letterSpacing: 0.8 }}>
                  COLLECTION
                </AppText>
              </View>
              <AppText variant="h2" style={{ marginTop: 6 }}>
                Shaadi Season
              </AppText>
              <AppText variant="caption" style={{ opacity: 0.8 }}>
                12 templates · from ₹49
              </AppText>
            </GradientFill>
          </PressableScale>
        </Animated.View>
      ) : null}

      <Animated.View entering={enterUp(stagger(3))} style={{ gap: 12 }}>
        <SectionHeader title="Shop by style" />
        <View style={[styles.hRow, { flexDirection: 'row' }]}>
          {STYLES.map((s) => {
            const on = style === s.id;
            return (
              <PressableScale
                key={s.id}
                haptic="selection"
                onPress={() => setStyle(on ? undefined : s.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.styleCard, on && styles.styleOn]}
              >
                <GradientFill colors={s.colors} vertical style={styles.styleIcon}>
                  <Icon name={s.icon} size={18} />
                </GradientFill>
                <AppText variant="label" style={{ fontSize: 14, marginTop: 4 }}>
                  {s.label}
                </AppText>
                <AppText variant="caption" color="muted" style={{ fontSize: 11 }}>
                  {`${s.count} templates`}
                </AppText>
              </PressableScale>
            );
          })}
        </View>
      </Animated.View>

      <Animated.View entering={enterUp(stagger(4))} style={{ gap: 12 }}>
        <SectionHeader title={query ? `Results for “${query}”` : 'Top this week'} />
        {isLoading ? (
          <ActivityIndicator color={colors.pink} style={{ marginTop: 24 }} />
        ) : top.length === 0 ? (
          <AppText variant="bodySm" color="muted" align="center" style={{ marginTop: 16 }}>
            No templates found. Try another word.
          </AppText>
        ) : (
          <View style={styles.grid}>
            {top.map((t, i) => (
              <Animated.View key={t.id} entering={enterUp(i * 60)}>
                <TemplateCard template={t} width={cardW} height={cardW * 1.55} onPress={open} />
              </Animated.View>
            ))}
          </View>
        )}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: screenPadding },
  search: {
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 14, paddingVertical: 0 },
  hRow: { paddingHorizontal: screenPadding, gap: 8 },
  featured: { height: 150, borderRadius: radius.xl + 2, padding: 18, justifyContent: 'flex-end', overflow: 'hidden' },
  diya: { position: 'absolute', right: -6, top: 0 },
  collectionBadge: { alignSelf: 'flex-start', backgroundColor: colors.gold, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  styleCard: {
    flex: 1,
    borderRadius: radius.lg + 2,
    padding: 12,
    gap: 4,
    backgroundColor: colors.glassSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  styleOn: { borderColor: colors.pink, backgroundColor: 'rgba(255,77,141,0.08)' },
  styleIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: screenPadding },
});
