import { useCurrentEvent, useTable } from './index';

/** Everything the director screens need for the current event, kept live. */
export function useDirectorData() {
  const event = useCurrentEvent();
  const eventId = event.data?.id ?? '__none__';
  const teams = useTable('teams', { eq: { eventId }, order: { column: 'name' } });
  const teamIds = teams.data.map((t) => t.id);
  const players = useTable('players', { in: { column: 'teamId', values: teamIds.length ? teamIds : ['__none__'] }, order: { column: 'lastName' } });
  const games = useTable('games', { eq: { eventId }, order: { column: 'startsAt' } });
  const notifications = useTable('notifications', { eq: { eventId }, order: { column: 'createdAt', ascending: false } });
  const invites = useTable('invites', { in: { column: 'teamId', values: teamIds.length ? teamIds : ['__none__'] } });

  const refresh = () => {
    event.refresh();
    teams.refresh();
    players.refresh();
    games.refresh();
    notifications.refresh();
    invites.refresh();
  };

  return {
    event: event.data,
    loading: event.loading || teams.loading,
    teams: teams.data,
    players: players.data,
    games: games.data,
    notifications: notifications.data,
    invites: invites.data,
    refresh,
  };
}
