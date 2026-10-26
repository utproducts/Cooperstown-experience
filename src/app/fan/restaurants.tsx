import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { imageSource } from '@/components/venue-image';
import { Badge, Caption, Empty, Card, H1, Icon, Row, Screen } from '@/components/ui';
import { C, Fonts, R, S } from '@/constants/theme';
import { usePlaces, useParkPhoto } from '@/data/venue';

/** The park's restaurants: tap one for its menu and to request a table. */
export default function Restaurants() {
  const places = usePlaces('restaurant');
  const fallback = useParkPhoto(0);
  const list = places.data.filter((p) => p.active);
  return (
    <Screen refreshing={places.loading} onRefresh={places.refresh}>
      <H1>Restaurants</H1>
      <Caption>Sit down, cool off and eat well, right here at the park.</Caption>
      {list.length === 0 && !places.loading && (
        <Card>
          <Empty icon="restaurant-outline" title="Restaurants are coming soon" />
        </Card>
      )}
      {list.map((r, i) => {
        const img = imageSource(r.imageUrl) ?? fallback;
        return (
          <Pressable key={r.id} accessibilityRole="button" onPress={() => router.push(`/fan/restaurant/${r.id}` as never)} style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}>
            {img ? <Image source={img} style={styles.image} resizeMode="cover" /> : <View style={[styles.image, { backgroundColor: i % 2 ? C.red : C.navy }]} />}
            <View style={styles.body}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={styles.name}>{r.name}</Text>
                <Icon name="chevron-forward" color={C.muted} />
              </Row>
              {r.hours ? <Caption>{r.hours}</Caption> : null}
              {r.description ? <Text style={styles.desc}>{r.description}</Text> : null}
              <Row>
                <Badge label="Menu" tone="navy" icon="book" />
                {r.takesReservations && <Badge label="Reservations" tone="green" icon="calendar" />}
              </Row>
            </View>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  image: { width: '100%', height: 140 },
  body: { padding: S.lg, gap: 6 },
  name: { fontFamily: Fonts.display, fontSize: 22, fontWeight: '700', color: C.navy },
  desc: { fontSize: 15, color: C.ink, lineHeight: 21 },
});
