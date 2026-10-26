import { useLocalSearchParams } from 'expo-router';

import { OrderFlow } from '@/components/order-flow';
import { Badge, Hero, Screen } from '@/components/ui';
import { useTable } from '@/data';
import { useFanData } from '@/data/fan';
import { usePlaces, useParkPhoto } from '@/data/venue';

/**
 * Concessions delivered to your field. A dugout's QR code opens this with ?field=Field%203&spot=Home%20dugout.
 */
export default function Food() {
  const { field, spot } = useLocalSearchParams<{ field?: string; spot?: string }>();
  const d = useFanData();
  const photo = useParkPhoto(1);
  const products = useTable('products', { eq: { kind: 'concession' }, order: { column: 'sort' } });
  const fieldPlaces = usePlaces('field');
  const eventId = d.event?.id ?? null;
  // The week's fields: from the map when staff pinned them, otherwise from the schedule.
  const fields = fieldPlaces.data.length
    ? fieldPlaces.data.map((f) => f.name)
    : [...new Set(d.games.map((g) => g.field))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return (
    <Screen refreshing={products.loading} onRefresh={products.refresh}>
      <Hero image={photo} eyebrow="Concessions" title="Order to your dugout" subtitle="Hot dogs, drinks and snacks brought right to your field. Pay when it arrives." />
      {field ? <Badge label={`Delivering to ${field}${spot ? ` · ${spot}` : ''}`} tone="green" icon="location" /> : null}
      <OrderFlow
        kind="concession"
        eventId={eventId}
        fields={fields}
        initialField={field ?? ''}
        initialSpot={spot ?? ''}
        products={products.data.filter((p) => p.eventId === null || p.eventId === eventId)}
      />
    </Screen>
  );
}
