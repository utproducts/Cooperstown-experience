import { describe, expect, it } from 'vitest';

import { SPECS, specToModel, specToRow } from '../../data/cooperstown-map';

describe('venue table mappings', () => {
  it('reads places with string ids', () => {
    const p = specToModel(SPECS.places, { id: 12, kind: 'parking', name: 'Main Lot', description: '', x: 0.1, y: 0.9, hours: '', website: '', phone: '', address: '', image_url: '', takes_reservations: false, sort: 0, active: true });
    expect(p).toMatchObject({ id: '12', kind: 'parking', imageUrl: '', takesReservations: false, x: 0.1 });
  });

  it('writes products with numeric ids and the week column, never the id on insert', () => {
    expect(specToRow(SPECS.products, { id: 'x', kind: 'menu', placeId: '4', eventId: null, name: 'Burger', priceCents: 1400, sizes: [] }, { insert: true })).toEqual({
      kind: 'menu',
      place_id: 4,
      week_id: null,
      name: 'Burger',
      price_cents: 1400,
      sizes: [],
    });
  });

  it('keeps database-set order fields out of staff updates', () => {
    expect(specToRow(SPECS.shop_orders, { status: 'out', totalCents: 1, items: [], pickupCode: 'X' })).toEqual({ status: 'out' });
  });

  it('reads reservation times as HH:MM and skills values as numbers', () => {
    expect(specToModel(SPECS.reservations, { id: 3, place_id: 9, at_time: '18:30:00', on_date: '2027-06-01', party_size: 6 })).toMatchObject({ id: '3', placeId: '9', atTime: '18:30' });
    expect(specToModel(SPECS.skills_results, { id: 1, event_id: 2, value: '14.21', display_name: 'Sam R.' })).toMatchObject({ skillsEventId: '2', value: 14.21 });
  });

  it('maps a team’s lodging by team', () => {
    expect(specToRow(SPECS.team_lodging, { teamId: 't1', placeId: '5', room: 'A3' })).toEqual({ team_id: 't1', place_id: 5, room: 'A3' });
  });
});
