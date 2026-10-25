# Cooperstown Experience

A family and tournament-director app for a 12U youth baseball week in Cooperstown, NY. It's one codebase that ships to the **App Store**, **Google Play** and the **web**, built with Expo (React Native) and backed by Supabase.

## What's in it

### For families (parents, players, coaches)
- **Follow a team with a team code.** The code comes in the invitation email when the director imports registrations. The link `https://<your-domain>/follow/CODE` follows the team in one tap.
- **Player portal.** The player's **check-in QR code** (scanned at arrival), arrival window and venue, departure info, a pre-arrival checklist (forms, uniform, packing), and the team roster.
- **Schedule.** My team's games, all games, live scores, pool **standings** and the **bracket**, all updating in real time.
- **Alerts.** Announcements, weather, delays and time changes, and final scores, sent as push notifications.
- **Meetings and sessions.** Book orientation, team photo, coaches meeting, director office hours and Hall of Fame visit slots. Capacity is enforced.
- **Photos.** Order team photos, memory mates, trading cards and action bundles (Stripe checkout).
- **Their week, always visible.** The week name and dates show on Home, Player and Schedule. Families with teams in more than one week (e.g. siblings) can switch between them.
- **Week guide.** Day-by-day itinerary (arrival and check-in, Opening Ceremonies, pool play, bracket, championship, departure), FAQ, and places around town.

### For directors
- **Week selection.** The season is a set of weeks (e.g. 16–17 weeks). The bar at the top of every director screen shows which week you're working on. Tap it to switch. Check-in, imports, the schedule builder, scores, alerts and exports all apply to that week. The default is the week happening today, otherwise the next one. Under **More → Weeks** you can create the whole season in one step (first arrival day, number of weeks, days per week) and edit each week's dates and venue.
- **Import registrations from LeagueApps.** Upload the registrations CSV export. Columns are detected automatically. The import creates teams, a unique **team follow code** per team, a **check-in QR token** per player, and an invite per parent or coach email, and it can email them right away. Re-imports are safe because existing teams and players are matched.
- **Check-in.** Scan player QR codes with the camera (phone, tablet or laptop webcam), or search and check in by hand. Progress is shown per team.
- **Schedule builder.** Split teams into pools automatically (balanced snake order), generate round-robin pool play into your days, times and fields (no double-booking, a minimum rest gap, a cap on games per day), then seed a single-elimination bracket from standings. Top seeds get byes automatically.
- **Scores.** Enter and remove scores, and mark games live or final. Going final notifies both teams and advances the bracket winner.
- **Delays and time changes.** Delay one game (and optionally every later game on that field), or delay a whole block, e.g. *all games after 2:00 PM, all fields, 60 min*. **Every affected team gets a push with its own new time.**
- **Push alerts.** Send to everyone or to chosen teams. Templates cover lightning hold, all clear, heat advisory, rain-out, and a one-tap **current forecast** post (Open-Meteo).
- **Exports.** Registrations (with team codes and check-in times), check-ins, and the full schedule as CSV.
- Meeting-slot management, photo packages and order fulfilment, and event (week) settings.

## Quick start (demo mode)

```bash
npm install
npm run web        # or: npm run ios / npm run android
```

If no Supabase project is configured, the app runs on **built-in sample data**: 16 teams, 192 players, a week in progress with scores. Data is stored on the device. On the sign-in screen, choose **Explore as a parent** or **Explore as a director**. You can also sign in with any email and code `123456` (`director@demo.app` signs in as the director). Demo team codes: `STOR-7K2Q`, `THUN-M4TX`, `OUTL-H8RN`.

## Project layout

```
src/
  app/                     Expo Router screens (file = route)
    welcome.tsx            sign in (email code) + demo entry
    follow/[code].tsx      invite deep link → follow team
    fan/(tabs)/…           Home, Schedule, Player, Alerts, More
    fan/…                  meetings, photos, guide, teams (stacked screens)
    director/(tabs)/…      Dashboard, Check-in, Games, Teams, Alerts, More
    director/…             import, builder, team/[id], meetings, orders, event
  components/              UI kit, game card/editor, schedule views, weather
  data/
    backend.ts             Backend interface (generic table CRUD + RPCs)
    demo.ts / seed.ts      in-memory demo backend with sample data
    supabase.ts            Supabase backend (RLS-aware, realtime)
    services.ts            director workflows: import, scheduling, scores, delays + notifications
  lib/                     pure logic, unit tested: CSV, LeagueApps mapping, team codes,
                           scheduler/standings/bracket, timezone math, weather parsing
supabase/
  migrations/              schema, RLS policies, RPCs, push trigger
  functions/               edge functions: push-dispatch, send-invites, create-checkout, stripe-webhook
  tests/rls.test.mjs       runs the migration in embedded Postgres and checks the security rules
```

## Connecting Supabase (production)

1. **Create a project** at supabase.com, then link it and apply the schema:
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
2. **Enable email codes.** Under Authentication → Email Templates → *Magic Link*, include `{{ .Token }}` so users receive a 6-digit code (the app signs in with codes, not links).
3. **Make yourself a director.** Directors are whoever is on the allowlist:
   ```sql
   insert into director_allowlist (email) values ('you@yourdomain.com');
   ```
4. **Push fan-out secrets.** New notification rows call the `push-dispatch` function through `pg_net`. Store two Vault secrets in the SQL editor:
   ```sql
   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
   select vault.create_secret('<service-role-key>', 'service_role_key');
   ```
5. **Deploy the functions and set their secrets:**
   ```bash
   npx supabase functions deploy push-dispatch send-invites create-checkout stripe-webhook
   npx supabase secrets set APP_URL=https://<your-web-domain> \
     RESEND_API_KEY=... INVITE_FROM_EMAIL="Cooperstown <invites@yourdomain.com>" \
     STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=... \
     EXPO_ACCESS_TOKEN=...   # optional, if Expo push security is enabled
   ```
   In Stripe, add a webhook for `checkout.session.completed` that points to `https://<ref>.supabase.co/functions/v1/stripe-webhook`.
6. **Configure the app.** Copy `.env.example` to `.env.local` and fill in `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` and `EXPO_PUBLIC_APP_URL`.

### How privacy works
- Team names and schedules are visible to any signed-in user.
- Rosters (first name, last name, jersey number) are visible only to people who **follow that team** (through its code) or have a child on it.
- Parent contact details and **check-in QR tokens** are visible only to directors and to the player's own guardian, matched by registration email.
- Team codes are visible only to directors, so a roster can't be discovered without an invitation.
- Only directors can check players in, change games, post alerts, or see all bookings and orders. Order prices are recomputed on the server.

`npm run test:db` checks all of this (31 checks).

## LeagueApps import format

Export registrations from LeagueApps as CSV. The importer recognizes common column names, including:

| Data | Example column names |
|---|---|
| Team (required) | `Team`, `Team Name`, `Assigned Team` (a trailing `(City, ST)` sets the city and state) |
| Player name (required) | `First Name` + `Last Name`, or `Name` / `Player Name` |
| Parent email | `Parent 1 Email`, `Parent Email`, `Guardian Email` (falls back to `Email`) |
| Parent name and phone | `Parent 1 First Name`/`Last Name`, `Parent 1 Phone` |
| Role | `Role` (rows containing *coach*, *manager* or *staff* become the team's coach) |
| Week routing | `Program` / `Session` / `Season` and `Program Start Date` / `Start Date` |
| Optional | `Jersey Number`, `Birth Date`, `Team ID`, `Member ID`, `Registration Status` (cancelled, withdrawn and waitlisted rows are skipped) |

**Which week registrations go to.** Rows are grouped by program/session. Each group is matched to a week by its start date (the date that falls inside the week), then by a week number in the program name ("Cooperstown Week 7 - 12U"), then by an exact week name. The director confirms or changes each match on the preview, and the import won't run until every group has a week. Without program columns, everything goes into the selected week. The same club registered for two different weeks becomes two separate teams. Invite emails state the week and dates.

Directors can download a template from the import screen.

## Push notifications

- Native push uses Expo push notifications. Run `npx eas-cli init` once to link an EAS project (this sets `extra.eas.projectId`), then set up credentials: an APNs key for iOS (EAS handles it during `eas build`) and FCM for Android.
- The web app gets live updates over realtime but doesn't receive push notifications.

## Shipping

- **Web:** `npx expo export -p web` creates `dist/`. Host it anywhere static (Vercel, Netlify, Cloudflare Pages) with a SPA fallback to `index.html`, so links like `/follow/CODE` and `/director/...` resolve.
- **iOS and Android:**
  ```bash
  npx eas-cli build --platform all --profile production
  npx eas-cli submit --platform ios      # App Store Connect
  npx eas-cli submit --platform android  # Google Play
  ```
  The bundle identifier and package are `com.utproducts.cooperstown` (in `app.json`). Change them before the first build if you want a different ID.

## Development

```bash
npm test            # unit tests (CSV/import, codes, scheduler, standings, bracket, delays, time, weather)
npm run test:db     # schema + RLS checks in embedded Postgres
npm run typecheck
npm run lint
```

## Before launch: decisions and content to confirm
- **Branding and photos.** The UI uses a classic navy, red and cream ballpark palette with no third-party logos or photos. Add licensed photography and your logo (`assets/images`, and the `Hero` component in `src/components/ui.tsx`). Don't copy images from other sites.
- **Week itinerary and FAQ** (`src/content/guide.ts`) follow the typical Cooperstown week format. Confirm times and details for your tournament.
- **Digital photo sales.** Apple and Google require in-app purchase for *digital* goods bought inside the mobile apps. The seeded packages are physical prints, which can use Stripe. Treat digital downloads separately.
- **Universal links.** Invite links open the web app. To open the installed app directly, add Associated Domains and App Links for your domain.
