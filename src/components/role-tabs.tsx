import { Redirect, router, Stack } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Pressable, Text, useWindowDimensions } from 'react-native';

import { C } from '@/constants/theme';
import { useAuth } from '@/data';
import type { Role } from '@/data/types';

import { Icon, type IconName } from './ui';
import { WeekBar, WeekChip } from './week-picker';

export interface TabDef {
  name: string;
  title: string;
  icon: IconName;
}

/** Bottom tabs on phones, a left sidebar on wide screens (web/tablet). */
export function RoleTabs({ tabs, weekBar, hidden = [] }: { tabs: TabDef[]; weekBar?: boolean; hidden?: string[] }) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  return (
    <Tabs
      screenOptions={{
        headerShown: !!weekBar,
        header: weekBar ? () => <WeekBar /> : undefined,
        tabBarActiveTintColor: wide ? C.white : C.red,
        tabBarInactiveTintColor: wide ? '#9FB0C8' : C.muted,
        tabBarActiveBackgroundColor: wide ? C.navySoft : undefined,
        tabBarPosition: wide ? 'left' : 'bottom',
        tabBarVariant: wide ? 'material' : 'uikit',
        tabBarLabelPosition: wide ? 'beside-icon' : 'below-icon',
        tabBarStyle: wide
          ? { backgroundColor: C.navy, borderRightWidth: 0, minWidth: 220, paddingTop: 24 }
          : { backgroundColor: C.white, borderTopColor: C.border },
        sceneStyle: { backgroundColor: C.cream },
      }}>
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, size }) => <Icon name={t.icon} color={color as string} size={size} />,
          }}
        />
      ))}
      {/* Routes the connected database doesn't support stay out of the tab bar. */}
      {hidden.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  );
}

/**
 * Stack for a role's area: the tab bar plus secondary screens pushed on top
 * with a back button. Redirects away once auth is known and doesn't match;
 * the navigator stays mounted meanwhile so deep links resolve correctly.
 */
export function RoleStack({ allow, home }: { allow: Role[]; home: '/fan' | '/director' }) {
  const { profile, ready } = useAuth();
  if (ready && !profile) return <Redirect href="/welcome" />;
  if (ready && profile && !allow.includes(profile.role)) return <Redirect href="/" />;
  return (
    <Stack
      screenOptions={{
        headerTitle: '',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: C.cream },
        headerTintColor: C.navy,
        contentStyle: { backgroundColor: C.cream },
        headerRight: home === '/director' ? () => <WeekChip /> : undefined,
        headerLeft: () => (
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace(home))}
            hitSlop={12}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 4 }}>
            <Icon name="chevron-back" color={C.navy} size={24} />
            <Text style={{ color: C.navy, fontSize: 16, fontWeight: '600' }}>Back</Text>
          </Pressable>
        ),
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
