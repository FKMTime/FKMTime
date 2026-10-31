# AGENTS.md

Guidance for AI agents (and people) working in this repository.

FKMTime runs speedcubing competitions without paper scorecards. Judges and
competitors use timing stations at the venue; the backend stores attempts and
syncs results to the WCA; the frontend is the panel for organisers and
delegates. User-facing docs: https://fkmtime.github.io/docs

## Specs

Only big features get a spec in [`docs/specs/`](docs/specs/README.md): new
functionality that spans several parts of the system, changes the database or
the messages between backend and stations, or changes how a round runs on
competition day. Bug fixes, small improvements, refactors and dependency bumps
don't need one — the PR description is enough.

- Before building a big feature, look for its spec. If you're implementing one,
  follow it, and cite its id (`SPEC-NNN`) in the PR description.
- If the code has to differ from the spec, update the spec in the same PR
  instead of letting them drift apart.
- If a big feature has no spec yet, write it first (copy
  `SPEC-000-template.md`) and get it agreed before writing code.
- If you're unsure whether something is big enough, it probably isn't — ask
  rather than writing a spec for a small change.

## Layout

| Path        | What it is                                                         |
|-------------|--------------------------------------------------------------------|
| `backend/`  | NestJS API + socket.io gateway, Prisma/PostgreSQL (`prisma/schema.prisma`) |
| `frontend/` | React + Vite + TypeScript panel, Tailwind + shadcn/ui               |
| `e2e/`      | Playwright tests driving the real frontend against the real backend |
| `nginx/`    | Reverse proxy config for the bundled image                         |
| `scripts/`  | Dev helpers (e.g. `docker-adapter.sh` for Bluetooth on macOS)      |
| `docs/specs/` | Specs                                                            |

Station firmware lives in [FKMTime/firmware](https://github.com/FKMTime/firmware)
and the device bridge in
[FKMTime/micro-connector](https://github.com/FKMTime/micro-connector). The
messages between them and the backend are a contract: treat changes to them as
breaking unless proven otherwise.

## Running the app

To run the app for a person to try, use the dev stack in `docker-compose.yml`.
On macOS always include the Bluetooth adapter and the micro connector, so a
real device can be connected at any point.

```bash
./scripts/docker-adapter.sh      # macOS only: start first and keep it running
docker compose pull dummy_wca dummy_wca_live micro_connector
docker compose up -d --build
docker compose exec backend npx ts-node prisma/seed/seed-test.ts
```

| What | Where |
|------|-------|
| Panel | http://localhost:5173, sign in with `admin` / `admin` |
| Backend | http://localhost:5000 (`/health`) |
| API tester, for station messages | http://localhost:5002 |
| Dummy WCA / WCA Live | http://localhost:3005 / http://localhost:4000 |

The seed needs the current dummy WCA image, hence the pull. Backend and frontend
source are mounted, so changes reload; rebuild after changing dependencies.

- **Keep the backend in Docker.** The connector talks to it over a unix socket
  in the `sock` volume, and a unix socket can't cross into the Docker VM on
  macOS. A backend started on the Mac itself looks fine, but no device can
  reach it.
- **Start the adapter before the stack.** The connector looks for it only at
  startup, so otherwise run `docker compose restart micro_connector`. macOS
  grants Bluetooth per app, so run the adapter from the person's own terminal
  and have them allow it under System Settings → Privacy & Security → Bluetooth.
- **One stack per machine.** The containers have fixed names, so stop a stack
  running from another worktree with `docker compose down` there first.
- **Run the frontend with Vite's dev server, never `vite preview`.** A production
  build ignores `VITE_BACKEND_ORIGIN` and `VITE_WCA_ORIGIN`.
- **Sample data:** a real device needs the competition's Wi-Fi details set in
  Setup, and real cards assigned to people. Check that "Update devices" is what
  you want before a device connects.

## Checks

Run the checks for the part you touched — the same ones CI runs.

```bash
# backend
cd backend && npm run lint && npm run format:check && npm run build
npm run test:no-watch            # unit tests
npm run test:e2e                 # e2e; needs the test stack below

# frontend
cd frontend && npm run lint && npm run format:check && npm run build
npm run test:no-watch
```

Backend e2e tests need PostgreSQL and the dummy WCA services:

```bash
docker compose -f docker-compose-test.yml up -d
cd backend && npx prisma db push && npm run prisma:seed-test && npm run test:e2e
```

The test seed imports the competition the dummy WCA generates (invented
people, a two-day schedule starting the day the dummy WCA started), so the
schedule is "live" and WCA sign-in and sync see the same competition. Its id,
dates and accounts come from `GET $WCA_ORIGIN/dummy/generated`; tests read
them from there or from the seeded WCIF instead of hard-coding them. To pin
the dates, start the dummy WCA with `GENERATED_START_DATE=YYYY-MM-DD`;
restarting it moves the competition to the new day, so reseed afterwards.

Browser e2e tests (Playwright) start the backend and frontend themselves and
use the same test stack; `npm ci` in `backend` and `frontend` first:

```bash
cd e2e && npm ci && npx playwright install chromium
npm run typecheck && npm run format:check
npx playwright test               # or a single file: npx playwright test tests/auth.spec.ts
```

Prefer running the single test file you changed over the whole suite while
iterating; leave the full run to CI.

## Rules

- **Competition day is the priority.** Anything a judge, scrambler or delegate
  touches during a round must keep working when the network is flaky or a
  station reconnects. Think about those cases explicitly.
- **WCA regulations win.** Don't change how attempts, penalties, cutoffs or time
  limits are recorded without checking the regulations and the spec.
- **Schema changes** go in `backend/prisma/schema.prisma`, and the seed data in
  `backend/prisma/seed/` must still work afterwards.
- **UI copy uses the user's task language**, not internal names — "Extra
  granted", not a status enum.
- **Tests come with the change.** Bug fixes get a test that fails without the
  fix; new endpoints and socket events get e2e coverage in `backend/test/`.
- **No real data** in code, tests, fixtures, commits or PRs — no real
  competitor names, WCA IDs, emails or production dumps. Invent values.
- Match the style of the surrounding code; don't reformat files you aren't
  otherwise changing.

## Git and PRs

- Commits and PR titles use Conventional Commits:
  `type(scope): description` (`feat`, `fix`, `docs`, `refactor`, `test`,
  `chore`, …), imperative and lower-case.
- Branch names describe the change: `feat/round-result-after-last-attempt`,
  `fix/…`, `chore/…`.
- One logical change per PR. The description says why, how it was tested, and
  which spec it implements.
