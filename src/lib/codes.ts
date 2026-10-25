// Crockford-style alphabet without ambiguous characters (0/O, 1/I/L).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomInt(max: number): number {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.getRandomValues) {
    const buf = new Uint32Array(1);
    c.getRandomValues(buf);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

export function randomToken(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** First four letters of the team's mascot/name, e.g. "Tampa Bay Rays 12U" -> "RAYS". */
export function teamPrefix(teamName: string): string {
  const words = teamName
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !/^\d+U?$/.test(w));
  const word = words[words.length - 1] ?? 'TEAM';
  return (word.replace(/[^A-Z]/g, '') || 'TEAM').slice(0, 4).padEnd(4, 'X');
}

/** Generates a team follow code that is not already in `taken`. */
export function generateTeamCode(teamName: string, taken: Set<string>): string {
  const prefix = teamPrefix(teamName);
  for (let attempt = 0; attempt < 1000; attempt++) {
    const code = `${prefix}-${randomToken(4)}`;
    if (!taken.has(code)) {
      taken.add(code);
      return code;
    }
  }
  throw new Error('Unable to generate a unique team code');
}

/** Normalizes user input like " rays 7k2q " into "RAYS-7K2Q". */
export function normalizeTeamCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (raw.length <= 4) return raw;
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

const QR_PREFIX = 'CXP1:';

export function checkInPayload(token: string): string {
  return `${QR_PREFIX}${token}`;
}

/** Returns the check-in token from a scanned QR value, or null if it isn't ours. */
export function parseCheckInPayload(value: string): string | null {
  const v = value.trim();
  if (!v.startsWith(QR_PREFIX)) return null;
  const token = v.slice(QR_PREFIX.length);
  return /^[A-Z0-9]{8,64}$/.test(token) ? token : null;
}
