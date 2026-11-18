import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';
import { useTemplates } from '@/api/hooks';
import type { Occasion, Template } from '@/api/types';
import { OCCASIONS } from '@/constants/catalog';
import {
  AppText,
  Avatar,
  GradientFill,
  Icon,
  IconButton,
  Lottie,
  PressableScale,
  Screen,
  SectionHeader,
  TAB_BAR_SPACE,
  TemplateCard,
  Vinyl,
} from '@/components';
import { useAuthStore } from '@/store/auth';
import { useCreateFlow } from '@/store/createFlow';
import { colors, enterUp, gradients, radius, screenPadding, shadows, stagger } from '@/theme';
import { greeting, initials } from '@/utils/format';


const openTemplates = (occasion?: Occasion) => {
  if (occasion) useCreateFlow.getState().set({ occasion });
  router.push(occasion ? { pathname: '/create/templates', params: { occasion } } : '/create/templates');
};

const openTemplate = (t: Template) => router.push({ pathname: '/create/template/[id]', params: { id: t.id } });

export default function Home() {
  const user = useAuthStore((s) => s.user);
  const { data: templates = [] } = useTemplates();
  const trending = templates.filter((t) => t.trending);
  const firstName = user?.name.split(' ')[0] ?? 'there';

  return (
    <Screen glow="top" bottomInset={TAB_BAR_SPACE} contentStyle={{ gap: 22 }}>
      {/* Header */}
      <Animated.View entering={enterUp(stagger(0))} style={styles.header}>
        <Avatar text={initials(user?.name ?? 'R')[0] ?? 'R'} />
        <View style={{ flex: 1 }}>
          <AppText variant="caption" color="muted">
            {greeting()}
          </AppText>
          <AppText variant="title" style={{ fontSize: 18 }}>
            {firstName}
          </AppText>
        </View>
        <IconButton icon="bell" label="Notifications">
          <Icon name="bell" size={20} />
          <View style={styles.dot} />
        </IconButton>
      </Animated.View>

      {/* Hero */}
      <Animated.View entering={enterUp(stagger(1))} style={{ paddingHorizontal: screenPadding }}>
        <PressableScale onPress={() => openTemplates('birthday')} style={[styles.heroShadow]} accessibilityRole="button" accessibilityLabel="Create a song gift">
          <GradientFill colors={gradients.hero} style={styles.hero}>
            <View style={styles.heroShine} />
            <View style={{ flex: 1, gap: 10 }}>
              <View style={styles.pill}>
                <AppText variant="micro">NEW · ₹49 per gift</AppText>
              </View>
              <AppText variant="h3" style={{ fontFamily: 'Inter_700Bold', fontSize: 21, lineHeight: 25 }}>
                {'Make their day\nwith a song'}
              </AppText>
              <View style={styles.cta}>
                <AppText variant="label" style={{ color: colors.ink }}>
                  Create now
                </AppText>
                <Icon name="arrowRight" size={16} color={colors.ink} strokeWidth={2.2} />
              </View>
            </View>
            <View style={styles.vinylWrap}>
              <Vinyl size={104} />
              <Lottie name="notes" style={styles.heroNotes} />
            </View>
          </GradientFill>
        </PressableScale>
      </Animated.View>

      {/* Occasions */}
      <Animated.View entering={enterUp(stagger(2))} style={{ gap: 12 }}>
        <SectionHeader title="Occasions" action="See all" onAction={() => openTemplates()} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
          {OCCASIONS.map((o) => (
            <PressableScale
              key={o.id}
              disabled={o.soon}
              onPress={() => openTemplates(o.id)}
              accessibilityRole="button"
              accessibilityLabel={o.soon ? `${o.label}, coming soon` : o.label}
              style={styles.occ}
            >
              <GradientFill colors={o.colors} vertical style={[styles.occIcon, o.soon && { opacity: 0.55 }]}>
                <Icon name={o.icon} size={22} />
              </GradientFill>
              <AppText variant="caption" style={{ color: o.soon ? colors.faint : colors.text, fontSize: 11 }}>
                {o.label}
              </AppText>
              {o.soon ? (
                <View style={styles.soon}>
                  <AppText variant="micro" style={{ color: colors.goldInk, fontSize: 8 }}>
                    SOON
                  </AppText>
                </View>
              ) : null}
            </PressableScale>
          ))}
        </ScrollView>
      </Animated.View>

      {/* Trending */}
      <Animated.View entering={enterUp(stagger(3))} style={{ gap: 12 }}>
        <SectionHeader title="Trending templates" action="See all" onAction={() => router.push('/(tabs)/explore')} />
        <FlatList
          horizontal
          data={trending}
          keyExtractor={(t) => t.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hRow}
          renderItem={({ item }) => <TemplateCard template={item} width={140} height={236} onPress={openTemplate} />}
        />
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: screenPadding },
  dot: { position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.pink },
  heroShadow: { borderRadius: radius.xxl, ...shadows.brandGlow, shadowColor: '#B44CF0' },
  hero: { borderRadius: radius.xxl, padding: 20, paddingRight: 12, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  heroShine: { position: 'absolute', width: 200, height: 200, borderRadius: 100, top: -90, right: -40, backgroundColor: 'rgba(255,255,255,0.14)' },
  pill: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  cta: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.text, borderRadius: 12, paddingLeft: 14, paddingRight: 12, paddingVertical: 9 },
  vinylWrap: { width: 110, height: 110, alignItems: 'center', justifyContent: 'center' },
  heroNotes: { position: 'absolute', width: 130, height: 130, top: -26, right: -18 },
  hRow: { paddingHorizontal: screenPadding, gap: 12 },
  occ: {
    width: 76,
    height: 98,
    borderRadius: radius.lg + 2,
    backgroundColor: colors.glassSoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  occIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  soon: { position: 'absolute', top: 6, right: 6, backgroundColor: colors.gold, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
});
