import { describe, expect, it } from 'vitest';
import { detectColumns, normalizeDate, parseRegistrations } from '../registrations';

const LEAGUEAPPS = [
  'Registration Status,First Name,Last Name,Birth Date,Team,Role,Jersey Number,Parent 1 First Name,Parent 1 Last Name,Parent 1 Email,Parent 1 Phone,Email',
  'Active,Mason,Reed,3/14/2014,"Tampa Bay Rays 12U (Tampa, FL)",Player,7,Jen,Reed,JEN@example.com,555-0101,',
  'Active,Leo,Diaz,2014-01-02,"Tampa Bay Rays 12U (Tampa, FL)",Player,12,Carlos,Diaz,carlos@example.com,555-0102,',
  'Active,Mike,Hart,,"Tampa Bay Rays 12U (Tampa, FL)",Head Coach,,,,,,coach@rays.org',
  'Cancelled,Sam,Gone,,"Tampa Bay Rays 12U (Tampa, FL)",Player,,,,gone@example.com,,',
  'Active,Ty,Cole,,"Lake Forest Thunder (Lake Forest, IL)",Player,3,,,,,ty.parent@example.com',
  'Active,No,Team,,,Player,,,,,,',
].join('\n');

describe('registrations import', () => {
  it('detects LeagueApps columns without confusing parent and member email', () => {
    const m = detectColumns(['First Name', 'Email', 'Parent 1 Email', 'Team']);
    expect(m.guardianEmail).toBe('Parent 1 Email');
    expect(m.email).toBe('Email');
  });

  it('groups players into teams and pulls out coaches', () => {
    const r = parseRegistrations(LEAGUEAPPS);
    expect(r.rowCount).toBe(6);
    expect(r.teams.map((t) => t.name)).toEqual(['Lake Forest Thunder', 'Tampa Bay Rays 12U']);
    const rays = r.teams[1];
    expect(rays.players).toHaveLength(2);
    expect(rays.coachName).toBe('Mike Hart');
    expect(rays.coachEmail).toBe('coach@rays.org');
    expect(rays.players[0]).toMatchObject({
      firstName: 'Mason',
      jerseyNumber: '7',
      birthDate: '2014-03-14',
      guardianName: 'Jen Reed',
      guardianEmail: 'jen@example.com',
    });
    const thunder = r.teams[0];
    expect(thunder).toMatchObject({ city: 'Lake Forest', state: 'IL' });
    // falls back to member email when there is no parent email column value
    expect(thunder.players[0].guardianEmail).toBe('ty.parent@example.com');
  });

  it('skips cancelled registrations and rows without a team', () => {
    const r = parseRegistrations(LEAGUEAPPS);
    expect(r.skipped).toBe(2);
    expect(r.issues.some((i) => i.row === 7 && /team/i.test(i.message))).toBe(true);
  });

  it('reports a missing team column', () => {
    const r = parseRegistrations('First Name,Last Name\nA,B');
    expect(r.issues[0].message).toMatch(/No team column/);
  });

  it('supports a single Name column', () => {
    const r = parseRegistrations('Player Name,Team Name,Parent Email\nMary Ann Smith,Hawks,p@x.io');
    expect(r.teams[0].players[0]).toMatchObject({ firstName: 'Mary Ann', lastName: 'Smith', guardianEmail: 'p@x.io' });
  });

  it('normalizes dates', () => {
    expect(normalizeDate('7/4/14')).toBe('2014-07-04');
    expect(normalizeDate('2014-7-4')).toBe('2014-07-04');
    expect(normalizeDate('July 4')).toBeNull();
  });
});

describe('program / week detection', () => {
  const csv = [
    'Program,Program Start Date,First Name,Last Name,Team,Parent Email',
    'Cooperstown Week 3 - 12U,06/20/2027,Ava,Stone,Hawks,a@x.io',
    'Cooperstown Week 3 - 12U,06/20/2027,Ben,Lowe,Hawks,b@x.io',
    'Cooperstown Week 9 - 12U,08/01/2027,Cal,Ruiz,Hawks,c@x.io',
  ].join('\n');

  it('keeps the same team in different programs separate and reads the start date', () => {
    const r = parseRegistrations(csv);
    expect(r.teams).toHaveLength(2);
    expect(r.teams.map((t) => [t.program, t.programStartDate, t.players.length])).toEqual([
      ['Cooperstown Week 3 - 12U', '2027-06-20', 2],
      ['Cooperstown Week 9 - 12U', '2027-08-01', 1],
    ]);
  });
});

describe('team-level export (one row per team)', () => {
  const csv = [
    'Name,Age Group,Organization,City,State,Team Rep Name,Team Rep Phone Number,Team Rep Email Address,Number of Players,Number of Coaches',
    'Arcadia Aces Black,12,ARCADIA ACES BASEBALL INC,Phoenix,AZ,Pat Coach,555-0100,PAT@aces.org,12,2',
    'Bandits,0,NOLA,New Orleans,LA,,,,11,1',
  ].join('\n');

  it('reads teams, organizations, reps and roster sizes without player rows', () => {
    const r = parseRegistrations(csv);
    expect(r.teamsOnly).toBe(true);
    expect(r.issues).toEqual([]);
    expect(r.teams.map((t) => [t.name, t.organization, t.city, t.state, t.rosterSize, t.players.length])).toEqual([
      ['Arcadia Aces Black', 'ARCADIA ACES BASEBALL INC', 'Phoenix', 'AZ', 12, 0],
      ['Bandits', 'NOLA', 'New Orleans', 'LA', 11, 0],
    ]);
    expect(r.teams[0]).toMatchObject({ coachName: 'Pat Coach', coachEmail: 'pat@aces.org', coachPhone: '555-0100' });
  });
});
