import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { C, R, S } from '@/constants/theme';

import { H2, Icon, Row } from './ui';

/** Bottom sheet on phones, centered dialog on wide screens. */
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <Row style={{ justifyContent: 'space-between', marginBottom: S.sm }}>
            <H2 style={{ flex: 1 }}>{title}</H2>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
              <Icon name="close" size={24} color={C.muted} />
            </Pressable>
          </Row>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: S.md, paddingBottom: S.lg }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,22,41,0.55)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '90%',
    backgroundColor: C.cream,
    borderTopLeftRadius: R.lg,
    borderTopRightRadius: R.lg,
    padding: S.lg,
    ...Platform.select({ web: { marginBottom: 'auto', marginTop: 'auto', borderRadius: R.lg } as object, default: {} }),
  },
});
