import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';
import { useDeleteAccount, useLibrary } from '@/api/hooks';
import {
  AppText,
  Avatar,
  GlassCard,
  Icon,
  IconButton,
  type IconName,
  PressableScale,
  Screen,
  SectionHeader,
  TAB_BAR_SPACE,
  Toggle,
} from '@/components';
import { brand } from '@/config/brand';
import { useAuthStore } from '@/store/auth';
import { colors, enterUp, gradients, radius, screenPadding, stagger } from '@/theme';
import { initials } from '@/utils/format';

const Row = ({
  icon,
  label,
  value,
  tone = 'default',
  right,
  onPress,
}: {
  icon: IconName;
  label: string;
  value?: string;
  tone?: 'default' | 'pink' | 'danger';
  right?: React.ReactNode;
  onPress?: () => void;
}) => {
  const c = tone === 'pink' ? colors.pinkSoft : tone === 'danger' ? colors.danger : colors.text;
  return (
    <PressableScale onPress={onPress} scaleTo={0.99} style={styles.row} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[styles.rowIcon, tone !== 'default' && { backgroundColor: tone === 'danger' ? 'rgba(255,92,92,0.14)' : 'rgba(255,122,168,0.14)' }]}>
        <Icon name={icon} size={18} color={c} />
      </View>
      <AppText variant="body" style={{ flex: 1, color: c }}>
        {label}
      </AppText>
      {right ?? (
        <>
          {value ? (
            <AppText variant="label" color="muted">
              {value}
            </AppText>
          ) : null}
          <Icon name="chevronRight" size={18} color={colors.disabled} />
        </>
      )}
    </PressableScale>
  );
};

export default function Profile() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const { data = [] } = useLibrary();
  const deleteAccountMutation = useDeleteAccount();
  const [notifications, setNotifications] = useState(true);

  const videos = data.filter((d) => d.kind === 'video');
  const stats = [
    { value: videos.length, label: 'Gifts made' },
    { value: videos.filter((v) => v.status === 'hd').length, label: 'Shared' },
    { value: data.filter((d) => d.kind === 'draft').length, label: 'Drafts' },
  ];

  const logout = () => {
    void signOut();
    router.replace('/(auth)/login');
  };

  const removeAccount = async () => {
    try {
      await deleteAccountMutation.mutateAsync();
      logout();
    } catch (e) {
      Alert.alert('Could not delete account', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const deleteAccount = () =>
    Alert.alert('Delete account?', 'This permanently deletes your account, videos and photos. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void removeAccount() },
    ]);

  return (
    <Screen glow="violet" bottomInset={TAB_BAR_SPACE} contentStyle={{ gap: 18 }}>
      <Animated.View entering={enterUp(stagger(0))} style={styles.header}>
        <AppText variant="h1" style={{ flex: 1 }}>
          Profile
        </AppText>
        <IconButton icon="settings" label="Settings" />
      </Animated.View>

      <Animated.View entering={enterUp(stagger(1))} style={styles.identity}>
        <Avatar text={initials(user?.name ?? 'Guest')} size={96} ring />
        <AppText variant="h3" style={{ marginTop: 10 }}>
          {user?.name ?? 'Guest'}
        </AppText>
        <AppText variant="bodySm" color="muted">
          {user?.email ?? user?.phone ?? ''}
        </AppText>
        <PressableScale style={styles.edit} accessibilityRole="button">
          <AppText variant="label">Edit profile</AppText>
        </PressableScale>
      </Animated.View>

      <Animated.View entering={enterUp(stagger(2))} style={{ paddingHorizontal: screenPadding }}>
        <GlassCard tone="soft" padding={16} style={styles.stats}>
          {stats.map((s, i) => (
            <View key={s.label} style={styles.statWrap}>
              <View style={styles.stat}>
                <AppText variant="h2">{s.value}</AppText>
                <AppText variant="caption" color="muted">
                  {s.label}
                </AppText>
              </View>
              {i < stats.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          ))}
        </GlassCard>
      </Animated.View>

      <Animated.View entering={enterUp(stagger(3))} style={{ gap: 12 }}>
        <SectionHeader title="Recent creations" action="See all" onAction={() => router.push('/(tabs)/library')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: screenPadding, gap: 10 }}>
          {videos.slice(0, 5).map((v) => (
            <PressableScale
              key={v.id}
              onPress={() => v.giftId && router.push({ pathname: '/create/preview', params: { giftId: v.giftId } })}
              style={styles.recent}
            >
              <LinearGradient colors={v.colors} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
              <LinearGradient colors={gradients.thumbShade} start={{ x: 0, y: 0.4 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
              <AppText variant="micro" numberOfLines={1} style={{ letterSpacing: 0 }}>
                {v.title.replace('For ', '')}
              </AppText>
            </PressableScale>
          ))}
        </ScrollView>
      </Animated.View>

      <Animated.View entering={enterUp(stagger(4))} style={styles.lists}>
        <GlassCard tone="soft" padding={6}>
          <Row icon="card" label="Payment history" />
          <Row icon="bell" label="Notifications" right={<Toggle value={notifications} onChange={setNotifications} label="Notifications" />} />
          <Row icon="globe" label="Language" value="English" />
        </GlassCard>
        <GlassCard tone="soft" padding={6}>
          <Row icon="help" label="Help & support" />
          <Row icon="shield" label="Privacy & terms" />
        </GlassCard>
        <GlassCard tone="soft" padding={6}>
          <Row icon="logout" label="Log out" tone="pink" right={<View />} onPress={logout} />
          <Row icon="trash" label="Delete account" tone="danger" right={<View />} onPress={deleteAccount} />
        </GlassCard>
        <AppText variant="caption" align="center" style={{ color: '#5E5873' }}>
          {`${brand.name} v${brand.version}`}
        </AppText>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: screenPadding },
  identity: { alignItems: 'center', gap: 4, paddingHorizontal: screenPadding },
  edit: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stats: { flexDirection: 'row' },
  statWrap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  divider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.1)' },
  recent: { width: 100, height: 150, borderRadius: radius.lg, overflow: 'hidden', justifyContent: 'flex-end', padding: 10 },
  lists: { paddingHorizontal: screenPadding, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, minHeight: 56 },
  rowIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.glass, alignItems: 'center', justifyContent: 'center' },
});
