import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { C, R, S } from '@/constants/theme';
import { useAuth } from '@/data';

import { Icon } from './ui';

/**
 * Demo mode only: a one-tap switch between the parent and staff views, so
 * people trying the app don't have to sign out and back in.
 */
export function DemoRoleSwitch() {
  const { backend, profile } = useAuth();
  if (backend.mode !== 'demo' || !backend.demoSignIn || !profile) return null;
  const isDirector = profile.role === 'director';
  const target = isDirector ? 'fan' : 'director';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={async () => {
        await backend.demoSignIn!(target);
        router.replace(target === 'director' ? '/director' : '/fan');
      }}
      style={({ pressed }) => [styles.bar, pressed && { opacity: 0.8 }]}>
      <Icon name="swap-horizontal" color="#8A6A00" size={18} />
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>DEMO · {isDirector ? 'STAFF VIEW' : 'PARENT VIEW'}</Text>
        <Text style={styles.action}>Switch to the {isDirector ? 'Parent' : 'Staff'} view</Text>
      </View>
      <Icon name="chevron-forward" color="#8A6A00" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    backgroundColor: C.goldSoft,
    borderColor: '#EAD9A0',
    borderWidth: 1,
    borderRadius: R.md,
    paddingHorizontal: S.md,
    paddingVertical: S.sm,
  },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: '#8A6A00' },
  action: { fontSize: 15, fontWeight: '700', color: C.navy },
});
