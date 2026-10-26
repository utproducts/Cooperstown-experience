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
- **Week selection.** The season is a set of weeks (e.g. 16–17 weeks). The bar at the top of every director screen shows which week you're working on. Tap it to switch. Check-in, imports, the schedule builder, scores, alerts and exports all apply to that week. The default is the week happening today, otherwise the next one. Under **More → Weeks** you can create the whole season in one step and edit each week's dates and venue. Cooperstown weeks are 6 days with no break days, so they roll: Day 1 falls on a different weekday each week.
- **Import registrations from LeagueApps.** Upload the registrations CSV export. Columns are detected automatically. The import creates teams, a unique **team follow code** per team, a **check-in QR token** per player, and an invite per parent or coach email, and it can email them right away. Re-imports are safe because existing teams and players are matched.
- **Check-in.** Scan player QR codes with the camera (phone, tablet or laptop webcam), or search and check in by hand. Progress is shown per team.
- **Schedule builder.** Builds the whole week at once with the Cooperstown schedule engine (ported from `utproducts/cooperstown` `lib/week-schedule.ts`):
  - **Pool play:** 6 games per team, paired across the whole field. Teams never play a team from their own organization, play out-of-state opponents first, and get exactly 3 home and 3 away games. At most 3 games a day, with a slot of rest between games.
  - **Brackets:** every team goes into a single-elimination bracket by pool record: Championship, then Monster, then Cooper. Teams are split evenly and the top seeds get byes. Bracket play starts one slot after the last pool game. A team's first bracket game counts toward the 3-a-day limit, and a team still winning may play a 4th.
  - **Before posting:** the director sees games per day, brackets, seeds and byes, and when each round plays. Bracket games show "Seed #N" until the director taps **Seed brackets from pool play**, which uses the standings order: win %, head to head, runs allowed, capped run differential, runs scored.
  - **Check:** on the real Week 1 2027 teams it reproduces the brief exactly: 397 games (300 pool, 97 bracket) and 84/84/84/72/66/7 games a day.
  - **Rules:** like the admin site, a week with scores can't be rebuilt, and seeding opens once every pool game is final.
- **Umpires and baseballs.** Each umpire or crew gets their own labelled code for the week (More → Weeks). Codes can be turned off, and each one shows when it was last used. Umpires open **Umpire? Enter scores** on the sign-in screen, enter the code, pick their day and field, and enter the final score and the **baseballs used**. They don't need an account. Directors can enter or fix baseballs in the game editor, see totals on the Games tab, and export them in the schedule CSV.
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

If no Supabase project is configured, the app runs on **built-in sample data**: 16 teams, 192 players, a week in progress with scores. Data is stored on the device. On the sign-in screen, choose **Explore as a parent** or **Explore as a director**. A gold bar at the top of the home screen switches between the two views at any time. You can also sign in with any email and code `123456` (`director@demo.app` signs in as the director). Demo team codes: `STOR-7K2Q`, `THUN-M4TX`, `OUTL-H8RN`. The demo also holds the real **2027 season**: Week 1 (May 30 – June 4) has the 100 registered teams, ready to schedule. Umpire codes: `UMP2027` and `UMPCREW` (Week 1 2027), and `UMPDEMO` (the sample week).

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
    cooperstown.ts         backend on the Cooperstown database (utproducts/cooperstown's tables and RPCs)
    cooperstown-map.ts     row <-> model mapping for that database (tested on real rows)
    services.ts            director workflows: import, scheduling, scores, delays + notifications
  lib/                     pure logic, unit tested: CSV, LeagueApps mapping, team codes,
                           scheduler/standings/bracket, timezone math, weather parsing
supabase/phase2-proposal/  draft family-feature tables, RLS, edge functions and tests (not applied anywhere)
```

## The Cooperstown database (production)

The app runs on the same database as the Cooperstown All Star Village admin site (`utproducts/cooperstown`, Supabase project **cooperstown**, `lkyrieejwifdbnhzcrul`), so directors use one system. To point a build at it, set:

```
EXPO_PUBLIC_SUPABASE_URL=https://lkyrieejwifdbnhzcrul.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<the project's publishable key>
```

The publishable key is safe to ship. Every rule lives in the database's row-level security (`src/data/cooperstown.ts` uses nothing else). Without these variables, the app runs in demo mode.

**What works on it today:**
- **Families and coaches** browse **published** weeks without an account and follow their team by picking it from the list. Followed teams are saved on the phone. They get the schedule, scores, standings and brackets.
- **Staff** sign in with their Cooperstown admin email and password. Membership in the `staff` table makes someone a director. They can:
  - switch weeks, create weeks, and publish or hide a week;
  - import teams (team, organization, hometown and team rep go to `teams` and `team_contacts`);
  - build the week with the same engine as the admin site, then seed the brackets once pool play is final;
  - move, delay or cancel games, and score games. Final scores go through `staff_score`, so bracket winners advance in the database;
  - check in each team with the week's checklist (`checkins`);
  - create per-umpire codes, and turn them on or off.
- **Umpires** use their own code (`ump_games` / `ump_score`) to enter final scores and baseballs used. Each score records which umpire's code entered it.
- **Shared rules with the admin site:** a week with scores can't be rebuilt, seeding waits until every pool game is final, and a score can't change once the next bracket game has one.

**Not there yet:** parent accounts, invite codes, player rosters with QR passes, push alerts, meetings and photos. Those screens are hidden when the app is connected to this database. Their tables are proposed in utproducts/cooperstown PR #1 (`supabase/proposals/`, tested, not applied) and need sign-off before anything is added to the production database.

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

- Push alerts need the phase 2 tables, so they're off when the app is connected to the Cooperstown database. They work in demo mode.
- Native push uses Expo push notifications. Run `npx eas-cli init` once to link an EAS project (this sets `extra.eas.projectId`), then set up credentials: an APNs key for iOS (EAS handles it during `eas build`) and FCM for Android.
- The web app gets live updates over realtime but doesn't receive push notifications.

## Shipping

- **Shareable preview:** `npm run build:preview` makes `dist-preview/`, a self-contained demo build that runs from any sub-path. It's used for the claude.ai preview link. It runs on demo data unless the Supabase variables are set at build time.

- **Live web app:** https://utproducts.github.io/Cooperstown-experience/ runs on the Cooperstown database. `.github/workflows/pages.yml` runs the tests, builds with `scripts/build-pages.sh` and publishes the `gh-pages` branch on every push.
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
npm run test:db     # phase 2 proposal: schema + RLS checks in embedded Postgres
npm run typecheck
npm run lint
```

## Before launch: decisions and content to confirm
- **Branding and photos.** The UI uses a classic navy, red and cream ballpark palette with no third-party logos or photos. Add licensed photography and your logo (`assets/images`, and the `Hero` component in `src/components/ui.tsx`). Don't copy images from other sites.
- **Week itinerary and FAQ** (`src/content/guide.ts`) follow the typical Cooperstown week format. Confirm times and details for your tournament.
- **Digital photo sales.** Apple and Google require in-app purchase for *digital* goods bought inside the mobile apps. The seeded packages are physical prints, which can use Stripe. Treat digital downloads separately.
- **Universal links.** Invite links open the web app. To open the installed app directly, add Associated Domains and App Links for your domain.
