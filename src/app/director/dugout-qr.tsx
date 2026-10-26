import { Platform, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button, Caption, H1, Screen } from '@/components/ui';
import { C, Fonts, R, S } from '@/constants/theme';
import { APP_URL } from '@/data';
import { useDirectorData } from '@/data/director';
import { usePlaces } from '@/data/venue';

const SPOTS = ['1st base side', '3rd base side'];

/** A sign for each side of the stands: families scan it to order concessions to their seat. Print from the web. */
export default function SeatQr() {
  const d = useDirectorData();
  const fieldPlaces = usePlaces('field');
  const fields = fieldPlaces.data.length
    ? fieldPlaces.data.map((f) => f.name)
    : [...new Set(d.games.map((g) => g.field))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const base = APP_URL.replace(/\/$/, '');
  return (
    <Screen>
      <H1>Seat QR codes</H1>
      <Caption>Post one on each side of the stands. Scanning it opens the concessions menu with delivery set to that field and side; families add where they’re sitting.</Caption>
      {Platform.OS === 'web' && <Button title="Print" icon="print" small onPress={() => window.print()} />}
      {fields.length === 0 && <Caption>Add fields under Site map & places (or build the schedule) first.</Caption>}
      <View style={styles.grid}>
        {fields.flatMap((f) =>
          SPOTS.map((spot) => {
            const url = `${base}/fan/food?field=${encodeURIComponent(f)}&spot=${encodeURIComponent(spot)}`;
            return (
              <View key={`${f}-${spot}`} style={styles.card}>
                <Text style={styles.title}>Hungry? Delivered to your seat</Text>
                <QRCode value={url} size={150} color={C.navy} backgroundColor={C.white} />
                <Text style={styles.where}>{f}</Text>
                <Text style={styles.spot}>{spot}</Text>
                <Caption style={{ textAlign: 'center' }}>Scan with your phone camera · pay on delivery</Caption>
              </View>
            );
          }),
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.md },
  card: { width: 230, backgroundColor: C.white, borderRadius: R.lg, borderWidth: 2, borderColor: C.navy, padding: S.md, alignItems: 'center', gap: 6 },
  title: { fontWeight: '800', color: C.red, fontSize: 14, textAlign: 'center' },
  where: { fontFamily: Fonts.display, fontSize: 24, fontWeight: '700', color: C.navy },
  spot: { fontWeight: '800', color: C.ink, fontSize: 16 },
});
