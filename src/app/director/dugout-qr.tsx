import { Platform, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button, Caption, H1, Screen } from '@/components/ui';
import { C, Fonts, R, S } from '@/constants/theme';
import { APP_URL } from '@/data';
import { useDirectorData } from '@/data/director';
import { usePlaces } from '@/data/venue';

const SPOTS = ['Home dugout', 'Away dugout'];

/** A card for each dugout: families scan it to order concessions straight to that spot. Print from the web. */
export default function DugoutQr() {
  const d = useDirectorData();
  const fieldPlaces = usePlaces('field');
  const fields = fieldPlaces.data.length
    ? fieldPlaces.data.map((f) => f.name)
    : [...new Set(d.games.map((g) => g.field))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const base = APP_URL.replace(/\/$/, '');
  return (
    <Screen>
      <H1>Dugout QR codes</H1>
      <Caption>Post one in each dugout. Scanning it opens the concessions menu with delivery set to that field and dugout.</Caption>
      {Platform.OS === 'web' && <Button title="Print" icon="print" small onPress={() => window.print()} />}
      {fields.length === 0 && <Caption>Add fields under Site map & places (or build the schedule) first.</Caption>}
      <View style={styles.grid}>
        {fields.flatMap((f) =>
          SPOTS.map((spot) => {
            const url = `${base}/fan/food?field=${encodeURIComponent(f)}&spot=${encodeURIComponent(spot)}`;
            return (
              <View key={`${f}-${spot}`} style={styles.card}>
                <Text style={styles.title}>Hungry? Order to your dugout</Text>
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
