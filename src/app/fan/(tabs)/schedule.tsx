import { useState } from 'react';

import { BracketView, GamesByDay, StandingsTable } from '@/components/schedule-views';
import { H1, Screen, Segmented } from '@/components/ui';
import { FamilyWeekLabel } from '@/components/week-picker';
import { useFanData } from '@/data/fan';

type Tab = 'mine' | 'all' | 'standings' | 'bracket';

export default function FanSchedule() {
  const d = useFanData();
  const [tab, setTab] = useState<Tab>(d.myTeamIds.length ? 'mine' : 'all');
  const tz = d.event?.timezone;
  return (
    <Screen refreshing={d.loading} onRefresh={d.refresh}>
      <H1>Schedule</H1>
      <FamilyWeekLabel />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'mine', label: 'My team' },
          { value: 'all', label: 'All games' },
          { value: 'standings', label: 'Standings' },
          { value: 'bracket', label: 'Bracket' },
        ]}
      />
      {tab === 'mine' && (
        <GamesByDay games={d.myGames} teams={d.teams} highlight={d.myTeamIds} timeZone={tz} emptyText="Follow a team to see its games here." />
      )}
      {tab === 'all' && <GamesByDay games={d.games} teams={d.teams} highlight={d.myTeamIds} timeZone={tz} />}
      {tab === 'standings' && <StandingsTable teams={d.teams} games={d.games} highlight={d.myTeamIds} />}
      {tab === 'bracket' && <BracketView games={d.games} teams={d.teams} highlight={d.myTeamIds} timeZone={tz} />}
    </Screen>
  );
}
