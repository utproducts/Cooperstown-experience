import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Orders and reservations placed on this phone (number + code), so guests without an account can check them later.
 */
export interface Receipt {
  kind: 'apparel' | 'concession' | 'reservation';
  id: string;
  code: string;
  label: string;
  at: string;
}

const KEY = 'cxp-receipts';

export async function loadReceipts(): Promise<Receipt[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');
  } catch {
    return [];
  }
}

export async function saveReceipt(r: Receipt) {
  const all = [r, ...(await loadReceipts()).filter((x) => !(x.kind === r.kind && x.id === r.id))].slice(0, 30);
  await AsyncStorage.setItem(KEY, JSON.stringify(all)).catch(() => {});
}
