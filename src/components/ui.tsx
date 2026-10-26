import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { C, Fonts, MaxWidth, R, S } from '@/constants/theme';

import { requestDialog } from './dialog-host';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 20, color = C.ink }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export function Screen({
  children,
  refreshing,
  onRefresh,
  scroll = true,
  padded = true,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
  padded?: boolean;
}) {
  const inner = <View style={[styles.inner, padded && styles.padded]}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}>
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

type TextProps = { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number; selectable?: boolean };

export const H1 = ({ children, style, ...p }: TextProps) => (
  <Text {...p} style={[styles.h1, style]}>
    {children}
  </Text>
);
export const H2 = ({ children, style, ...p }: TextProps) => (
  <Text {...p} style={[styles.h2, style]}>
    {children}
  </Text>
);
export const H3 = ({ children, style, ...p }: TextProps) => (
  <Text {...p} style={[styles.h3, style]}>
    {children}
  </Text>
);
export const Body = ({ children, style, ...p }: TextProps) => (
  <Text {...p} style={[styles.body, style]}>
    {children}
  </Text>
);
export const Caption = ({ children, style, ...p }: TextProps) => (
  <Text {...p} style={[styles.caption, style]}>
    {children}
  </Text>
);
export const Eyebrow = ({ children, style }: TextProps) => <Text style={[styles.eyebrow, style]}>{children}</Text>;

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  small,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = buttonVariants[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: v.bg, borderColor: v.border },
        pressed && !off && styles.pressed,
        off && { opacity: 0.5 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={v.fg} size="small" />
      ) : (
        <>
          {icon && <Icon name={icon} size={small ? 16 : 18} color={v.fg} />}
          <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: v.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const buttonVariants: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: C.red, fg: C.white, border: C.red },
  dark: { bg: C.navy, fg: C.white, border: C.navy },
  secondary: { bg: C.white, fg: C.navy, border: C.border },
  ghost: { bg: 'transparent', fg: C.navy, border: 'transparent' },
  danger: { bg: C.white, fg: C.red, border: C.red },
};

export function Field({ label, hint, style, ...props }: TextInputProps & { label?: string; hint?: string }) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput placeholderTextColor={C.muted} {...props} style={[styles.input, props.multiline && { minHeight: 90, textAlignVertical: 'top' }, style]} />
      {hint ? <Caption>{hint}</Caption> : null}
    </View>
  );
}

type Tone = 'navy' | 'red' | 'green' | 'gold' | 'muted' | 'warn';
const tones: Record<Tone, { bg: string; fg: string }> = {
  navy: { bg: '#E6ECF5', fg: C.navy },
  red: { bg: C.redSoft, fg: C.red },
  green: { bg: C.greenSoft, fg: C.green },
  gold: { bg: C.goldSoft, fg: '#8A6A00' },
  muted: { bg: '#EEF0F3', fg: C.muted },
  warn: { bg: C.warnSoft, fg: C.warn },
};

export function Badge({ label, tone = 'navy', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const t = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      {icon && <Icon name={icon} size={12} color={t.fg} />}
      <Text style={[styles.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function Row({ children, style, gap = S.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Stack({ children, style, gap = S.md }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ gap: S.md }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <H3>{title}</H3>
        {action}
      </Row>
      {children}
    </View>
  );
}

export function ListItem({
  icon,
  title,
  subtitle,
  right,
  onPress,
  iconColor = C.navy,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  iconColor?: string;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.listItem, pressed && styles.pressed]}>
      {icon && (
        <View style={styles.listIcon}>
          <Icon name={icon} size={20} color={iconColor} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.listTitle}>{title}</Text>
        {subtitle ? <Caption numberOfLines={2}>{subtitle}</Caption> : null}
      </View>
      {right ?? (onPress && <Icon name="chevron-forward" size={18} color={C.muted} />)}
    </Pressable>
  );
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.border }} />;
}

export function Empty({ icon = 'baseball-outline', title, body, action }: { icon?: IconName; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Icon name={icon} size={36} color={C.muted} />
      <H3 style={{ textAlign: 'center' }}>{title}</H3>
      {body ? <Body style={{ textAlign: 'center', color: C.muted }}>{body}</Body> : null}
      {action}
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.segmented}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segment, value === o.value && styles.segmentActive]}>
          <Text style={[styles.segmentText, value === o.value && { color: C.white }]}>{o.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function Stat({ label, value, tone = C.navy }: { label: string; value: string | number; tone?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: tone }]}>{value}</Text>
      <Caption>{label}</Caption>
    </View>
  );
}

export function Progress({ value, color = C.green }: { value: number; color?: string }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(1, value)) * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

/** Navy hero band with baseball stitching. */
export function Hero({ eyebrow, title, subtitle, children }: { eyebrow?: string; title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <LinearGradient colors={[C.navy, C.navySoft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <Stitches />
      {eyebrow ? <Eyebrow style={{ color: C.gold }}>{eyebrow}</Eyebrow> : null}
      <Text style={styles.heroTitle}>{title}</Text>
      {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
      {children}
    </LinearGradient>
  );
}

function Stitches() {
  return (
    <View pointerEvents="none" style={styles.stitchWrap}>
      <View style={styles.stitchCircle}>
        {Array.from({ length: 14 }).map((_, i) => (
          <View key={i} style={[styles.stitch, { transform: [{ rotate: `${i * 12 - 80}deg` }, { translateY: -128 }] }]} />
        ))}
      </View>
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={C.red} />
    </View>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.errorNote}>
      <Icon name="alert-circle" size={18} color={C.red} />
      <Body style={{ color: C.red, flex: 1 }}>{message}</Body>
    </View>
  );
}

/** Message box: system Alert on native, in-app dialog on web. */
export function showMessage(title: string, message?: string) {
  if (Platform.OS === 'web') {
    requestDialog({ title, message });
  } else {
    Alert.alert(title, message);
  }
}

export function confirmAction(title: string, message: string, confirmLabel = 'OK'): Promise<boolean> {
  if (Platform.OS === 'web') return requestDialog({ title, message, confirmLabel, cancelLabel: 'Cancel', destructive: true });
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

export const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  scroll: { flexGrow: 1, alignItems: 'center' },
  inner: { width: '100%', maxWidth: MaxWidth, gap: S.lg, flexGrow: 1 },
  padded: { padding: S.lg, paddingBottom: S.xxl * 2 },
  h1: { fontFamily: Fonts.display, fontSize: 30, fontWeight: '700', color: C.navy, letterSpacing: -0.5 },
  h2: { fontFamily: Fonts.display, fontSize: 22, fontWeight: '700', color: C.navy },
  h3: { fontSize: 17, fontWeight: '700', color: C.ink },
  body: { fontSize: 15, lineHeight: 22, color: C.ink },
  caption: { fontSize: 13, lineHeight: 18, color: C.muted },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase', color: C.red },
  label: { fontSize: 13, fontWeight: '700', color: C.navy },
  card: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: S.lg,
    gap: S.md,
    borderWidth: 1,
    borderColor: C.border,
    ...Platform.select({
      web: { boxShadow: '0 1px 2px rgba(14,35,64,0.06)' },
      default: { shadowColor: C.navy, shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
    }),
  },
  pressed: { opacity: 0.75 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.sm,
    minHeight: 48,
    paddingHorizontal: S.lg,
    borderRadius: R.md,
    borderWidth: 1.5,
  },
  buttonSmall: { minHeight: 36, paddingHorizontal: S.md },
  buttonText: { fontSize: 16, fontWeight: '700' },
  input: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    paddingHorizontal: S.md,
    paddingVertical: 12,
    fontSize: 16,
    color: C.ink,
  },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.sm },
  listIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center' },
  listTitle: { fontSize: 16, fontWeight: '600', color: C.ink },
  empty: { alignItems: 'center', justifyContent: 'center', gap: S.sm, padding: S.xl },
  segmented: { gap: S.sm, paddingVertical: 2 },
  segment: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.pill, backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
  segmentActive: { backgroundColor: C.navy, borderColor: C.navy },
  segmentText: { fontSize: 14, fontWeight: '700', color: C.navy },
  stat: { flex: 1, minWidth: 90, gap: 2 },
  statValue: { fontSize: 28, fontWeight: '800', fontFamily: Fonts.display },
  progressTrack: { height: 8, backgroundColor: C.creamDeep, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  hero: { borderRadius: R.lg, padding: S.xl, gap: S.sm, overflow: 'hidden' },
  heroTitle: { fontFamily: Fonts.display, fontSize: 30, fontWeight: '700', color: C.white, letterSpacing: -0.5 },
  heroSubtitle: { fontSize: 15, color: '#C9D4E5', lineHeight: 22 },
  stitchWrap: { position: 'absolute', right: -150, top: -60, width: 300, height: 300 },
  stitchCircle: { width: 300, height: 300, borderRadius: 150, borderWidth: 2, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  stitch: { position: 'absolute', width: 14, height: 3, borderRadius: 2, backgroundColor: 'rgba(200,16,46,0.55)' },
  errorNote: { flexDirection: 'row', gap: S.sm, alignItems: 'flex-start', backgroundColor: C.redSoft, padding: S.md, borderRadius: R.md },
});
