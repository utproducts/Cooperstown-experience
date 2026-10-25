import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { C, Fonts, R, S } from '@/constants/theme';

/**
 * In-app message/confirm dialogs for the web build. Browsers' alert() and
 * confirm() are ugly and are blocked in sandboxed hosts (embedded previews),
 * so web uses this; native keeps the system Alert.
 */

export interface DialogRequest {
  title: string;
  message?: string;
  confirmLabel?: string;
  /** Without a cancel label the dialog is a plain message with one button. */
  cancelLabel?: string;
  destructive?: boolean;
  resolve: (ok: boolean) => void;
}

let push: ((d: DialogRequest) => void) | null = null;
const pending: DialogRequest[] = [];

export function requestDialog(d: Omit<DialogRequest, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    const req = { ...d, resolve };
    if (push) push(req);
    else pending.push(req);
  });
}

export function DialogHost() {
  // Pick up anything requested before the host mounted.
  const [queue, setQueue] = useState<DialogRequest[]>(() => pending.splice(0));
  useEffect(() => {
    push = (d) => setQueue((q) => [...q, d]);
    return () => {
      push = null;
    };
  }, []);

  const current = queue[0];
  const close = (ok: boolean) => {
    current?.resolve(ok);
    setQueue((q) => q.slice(1));
  };

  return (
    <Modal visible={!!current} transparent animationType="fade" onRequestClose={() => close(false)}>
      <View style={styles.backdrop}>
        {current && (
          <View style={styles.box} accessibilityRole="alert">
            <Text style={styles.title}>{current.title}</Text>
            {current.message ? <Text style={styles.message}>{current.message}</Text> : null}
            <View style={styles.actions}>
              {current.cancelLabel && (
                <Pressable onPress={() => close(false)} style={({ pressed }) => [styles.btn, styles.cancel, pressed && styles.pressed]}>
                  <Text style={[styles.btnText, { color: C.navy }]}>{current.cancelLabel}</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => close(true)}
                style={({ pressed }) => [styles.btn, { backgroundColor: current.destructive ? C.red : C.navy }, pressed && styles.pressed]}>
                <Text style={[styles.btnText, { color: C.white }]}>{current.confirmLabel ?? 'OK'}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,22,41,0.55)', alignItems: 'center', justifyContent: 'center', padding: S.lg },
  box: { width: '100%', maxWidth: 420, backgroundColor: C.white, borderRadius: R.lg, padding: S.xl, gap: S.md },
  title: { fontFamily: Fonts.display, fontSize: 20, fontWeight: '700', color: C.navy },
  message: { fontSize: 15, lineHeight: 22, color: C.ink },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: S.sm, marginTop: S.sm },
  btn: { minHeight: 44, paddingHorizontal: S.lg, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  cancel: { backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border },
  btnText: { fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.75 },
});
