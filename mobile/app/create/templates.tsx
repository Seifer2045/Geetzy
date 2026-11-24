import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated from 'react-native-reanimated';
import { useTemplates } from '@/api/hooks';
import type { Template, TemplateStyle } from '@/api/types';
import { AppText, Chip, Icon, Screen, TemplateCard, TopBar } from '@/components';
import { useCategoryTiles } from '@/hooks/useCategoryTiles';
import { useCreateFlow } from '@/store/createFlow';
import { colors, enterUp, fonts, screenPadding } from '@/theme';

const STYLE_FILTERS: { id: TemplateStyle | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'bollywood', label: 'Bollywood' },
  { id: 'retro', label: 'Retro' },
  { id: 'genz', label: 'Gen Z' },
];

export default function Templates() {
  const params = useLocalSearchParams<{ occasion?: string }>();
  const tiles = useCategoryTiles();
  const [occasion, setOccasion] = useState<string | undefined>(params.occasion);
  const [style, setStyle] = useState<TemplateStyle | 'all'>('all');
  const [q, setQ] = useState('');
  const { width } = useWindowDimensions();
  const cardW = (width - screenPadding * 2 - 12) / 2;
  const { data = [], isLoading } = useTemplates({ category: occasion, style: style === 'all' ? undefined : style, q: q || undefined });

  const open = (t: Template) => {
    useCreateFlow.getState().set({ occasion: t.occasion });
    router.push({ pathname: '/create/template/[id]', params: { id: t.id } });
  };

  return (
    <Screen glow="violet" contentStyle={{ gap: 14 }}>
      <TopBar title={occasion ? `${tiles.find((x) => x.id === occasion)?.label ?? occasion} templates` : 'All templates'} step={1} />

      <View style={styles.pad}>
        <View style={styles.search}>
          <Icon name="search" size={18} color={colors.faint} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search templates"
            placeholderTextColor={colors.faint}
            selectionColor={colors.pink}
            style={styles.searchInput}
            accessibilityLabel="Search templates"
          />
        </View>
      </View>

      {!params.occasion ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
          <Chip label="Any occasion" selected={!occasion} onPress={() => setOccasion(undefined)} />
          {tiles.filter((o) => !o.soon).map((o) => (
            <Chip key={o.id} label={o.label} icon={o.icon} selected={occasion === o.id} onPress={() => setOccasion(o.id)} />
          ))}
        </ScrollView>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
        {STYLE_FILTERS.map((s) => (
          <Chip key={s.id} label={s.label} selected={style === s.id} onPress={() => setStyle(s.id)} />
        ))}
      </ScrollView>

      {isLoading ? (
        <ActivityIndicator color={colors.pink} style={{ marginTop: 40 }} />
      ) : data.length === 0 ? (
        <AppText variant="bodySm" color="muted" align="center" style={{ marginTop: 32 }}>
          No templates match. Try another style.
        </AppText>
      ) : (
        <View style={styles.grid}>
          {data.map((t, i) => (
            <Animated.View key={t.id} entering={enterUp(i * 60)}>
              <TemplateCard template={t} width={cardW} height={cardW * 1.62} onPress={open} />
            </Animated.View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: screenPadding },
  search: {
    height: 46,
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: screenPadding },
});
