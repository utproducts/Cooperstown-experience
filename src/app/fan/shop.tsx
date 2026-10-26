import { OrderFlow } from '@/components/order-flow';
import { Hero, Screen } from '@/components/ui';
import { useTable } from '@/data';
import { useFanData } from '@/data/fan';
import { useParkPhoto } from '@/data/venue';

/** Official apparel, hats and pins. Paid at pickup until online payment is connected. */
export default function Shop() {
  const d = useFanData();
  const photo = useParkPhoto(2);
  const products = useTable('products', { eq: { kind: 'apparel' }, order: { column: 'sort' } });
  const eventId = d.event?.id ?? null;
  return (
    <Screen refreshing={products.loading} onRefresh={products.refresh}>
      <Hero image={photo} eyebrow="Official gear" title="The Shop" subtitle="Hats, tees, pins and more. Order here, pick up at the Info & Pro Shop." />
      <OrderFlow kind="apparel" eventId={eventId} products={products.data.filter((p) => p.eventId === null || p.eventId === eventId)} />
    </Screen>
  );
}
