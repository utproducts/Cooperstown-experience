import { useLocalSearchParams } from 'expo-router';

import { PlaceCard } from '@/components/park-ui';
import { Caption, Card, Empty, H1, Hero, Screen } from '@/components/ui';
import type { PlaceKind } from '@/data/types';
import { usePlaces, useParkPhoto } from '@/data/venue';
import { PLACE_KINDS } from '@/lib/venue';

const COPY: Partial<Record<PlaceKind, { eyebrow: string; title: string; subtitle: string; empty: string }>> = {
  vendor: { eyebrow: 'At the park', title: 'Vendors', subtitle: 'Treats, cards, custom gear and games, all on site.', empty: 'Vendors for this season are coming soon.' },
  attraction: { eyebrow: 'Around town', title: 'Things to do', subtitle: 'Between games: the Hall of Fame, Main Street, the lake and more.', empty: 'Ideas for things to do are coming soon.' },
  lodging: { eyebrow: 'Around town', title: 'Lodging nearby', subtitle: 'Hotels, inns and rentals for families staying off site.', empty: 'Lodging suggestions are coming soon.' },
  restaurant: { eyebrow: 'At the park', title: 'Restaurants', subtitle: 'Sit down, cool off and eat well.', empty: 'Restaurants are coming soon.' },
};

/** A list of places of one kind: vendors, things to do, lodging nearby. ?kind=vendor */
export default function Places() {
  const { kind = 'vendor' } = useLocalSearchParams<{ kind?: PlaceKind }>();
  const places = usePlaces(kind);
  const photo = useParkPhoto(kind === 'attraction' ? 1 : 0);
  const copy = COPY[kind] ?? { eyebrow: 'The park', title: PLACE_KINDS[kind]?.plural ?? 'Places', subtitle: '', empty: 'Nothing here yet.' };
  const shown = places.data.filter((p) => p.active);
  return (
    <Screen refreshing={places.loading} onRefresh={places.refresh}>
      {kind === 'attraction' || kind === 'lodging' ? (
        <Hero image={photo} eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle} />
      ) : (
        <>
          <H1>{copy.title}</H1>
          <Caption>{copy.subtitle}</Caption>
        </>
      )}
      {shown.length === 0 && !places.loading ? (
        <Card>
          <Empty icon="location-outline" title={copy.empty} />
        </Card>
      ) : (
        shown.map((p) => <PlaceCard key={p.id} place={p} />)
      )}
    </Screen>
  );
}
