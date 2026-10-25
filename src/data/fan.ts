import { useMemo } from 'react';

import { useCurrentEvent, useMyFollows, useMyPlayers, useTable } from './index';

/** Everything the family-facing screens need, kept live. */
export function useFanData() {
  const event = useCurrentEvent();
  const follows = useMyFollows();
  const myPlayers = useMyPlayers();
  const eventId = event.data?.id ?? '__none__';
  const teams = useTable('teams', { eq: { eventId } });
  const games = useTable('games', { eq: { eventId }, order: { column: 'startsAt' } });
  const notifications = useTable('notifications', { eq: { eventId }, order: { column: 'createdAt', ascending: false } });

  const myTeamIds = useMemo(() => {
    const ids = new Set(follows.data);
    myPlayers.data.forEach((p) => ids.add(p.teamId));
    return [...ids];
  }, [follows.data, myPlayers.data]);

  const myGames = useMemo(
    () => games.data.filter((g) => myTeamIds.includes(g.homeTeamId ?? '') || myTeamIds.includes(g.awayTeamId ?? '')),
    [games.data, myTeamIds],
  );

  const myNotifications = useMemo(
    () => notifications.data.filter((n) => n.teamIds.length === 0 || n.teamIds.some((id) => myTeamIds.includes(id))),
    [notifications.data, myTeamIds],
  );

  const refresh = () => {
    event.refresh();
    follows.refresh();
    myPlayers.refresh();
    teams.refresh();
    games.refresh();
    notifications.refresh();
  };

  return {
    event: event.data,
    loading: event.loading || teams.loading || games.loading,
    teams: teams.data,
    games: games.data,
    myTeamIds,
    myTeams: teams.data.filter((t) => myTeamIds.includes(t.id)),
    myGames,
    myPlayers: myPlayers.data,
    notifications: myNotifications,
    refresh,
  };
}
