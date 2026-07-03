import { useRouter, useSegments } from 'expo-router';
import { useMemo } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme, type Theme } from '../constants/theme';

const TABS = [
  { icon: '🔍', label: 'Discover',     route: '/',                      key: '' },
  { icon: '🤖', label: 'AI Assistant', route: '/screens/aiAssistant',   key: 'aiAssistant' },
  { icon: '🪴', label: 'Collection',   route: '/screens/collection',    key: 'collection' },
  { icon: '📜', label: 'History',      route: '/screens/history',       key: 'history' },
  { icon: '👤', label: 'Profile',      route: '/screens/profile',       key: 'profile' },
  { icon: '⚙️', label: 'Settings',     route: '/screens/settings',      key: 'settings' },
] as const;

// Bottom safe-area inset: approximated without a native dependency.
const BOTTOM_INSET = Platform.OS === 'ios' ? 20 : 8;
const BAR_HEIGHT = 56 + BOTTOM_INSET;

export { BAR_HEIGHT };

export default function BottomTabBar() {
  const router = useRouter();
  const segments = useSegments();
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);

  // Empty segments array means we're at the index route (/), so fall back to ''.
  const lastSegment = segments[segments.length - 1] ?? '';

  return (
    <View style={s.outerWrapper}>
      <View style={[s.bar, Platform.OS === 'web' && s.barWeb]}>
        {TABS.map(tab => {
          const isActive = tab.key === lastSegment;
          return (
            <TouchableOpacity
              key={tab.key}
              style={s.tab}
              onPress={() => router.push(tab.route)}
              activeOpacity={0.7}
            >
              <Text style={s.tabIcon}>{tab.icon}</Text>
              <Text style={[s.tabLabel, isActive && s.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  outerWrapper: {
    backgroundColor: t.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.border,
  },
  bar: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
    paddingBottom: BOTTOM_INSET,
  },
  // On web, constrain and center the tab strip to avoid it stretching on wide viewports.
  barWeb: {
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    gap: 2,
  },
  tabIcon:       { fontSize: 22 },
  tabLabel:      { fontSize: 10, fontWeight: '600', color: t.textMuted },
  tabLabelActive:{ color: t.accent },
});
