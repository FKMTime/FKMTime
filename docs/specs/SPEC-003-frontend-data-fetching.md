# SPEC-003: Shared data fetching in the frontend

- **Status:** Accepted
- **Created:** 2026-11-03
- **Related:** #543 (`eslint-plugin-react-hooks` 7), #553 (first
  `set-state-in-effect` batch)

**Decided:** adopt TanStack Query for reading server data, and migrate page by
page. See *Decisions* at the end.

## Problem

Every page in the panel loads its own data in `useEffect`. There are about 85
such effects across about 60 files, with no shared code for loading, errors,
stale responses or reconnects. Each page does as much of that as its author
remembered, and that shows up as problems for delegates and organisers on
competition day, when the network is at its worst:

- **Missed updates after a reconnect.** Some pages rejoin their socket room and
  refetch after a reconnect, some rejoin but don't refetch (`Results`), and some
  do neither (`Home`). A page can look live while showing old data.
- **Stale responses overwrite newer ones.** Only 7 files guard against this, and
  nothing cancels requests. Switching round quickly on `Results` can show the
  previous round's results.
- **Failures are invisible.** `backendRequest` returns a raw `Response`, and a
  failed read shows nothing on any page. A rejected request can leave a page on
  its loading state for good (`Devices`). `getAllDevices` turns any failure into
  an empty list, so "request failed" looks like "no devices".
- **Hand-written socket code drifts.** `Devices` never removes its listeners, so
  they pile up on every reconnect and outlive the page. Its socket refetch also
  drops the selected room filter. `Results` leaves and rejoins its room on every
  search change.
- **The same data is fetched repeatedly.** Rooms are fetched separately in over
  a dozen files with no cache, and incident counts are fetched by both `Layout`
  and `IncidentsLayout` on each incident event.
- **Bad data can reach shared state.** `Layout` writes the competition response
  into `competitionAtom` without checking it succeeded, and 35 files read that
  atom.

`react-hooks/set-state-in-effect` is also off because of this: 34 of its 40
findings remain after #553, mostly loading state set at the start of a fetch.
The rule is the prompt for this work, not the reason for it. Satisfying it alone
wouldn't fix any problem above.

## Goals

- Pages read server data one way, with stale responses handled by default.
- After a socket reconnect, every page on screen shows current data.
- A failed read is visible, and data already on screen stays there.
- Pages joining a socket room use one shared hook, so listeners can't leak.
- Data used by several pages is fetched once.
- `react-hooks/set-state-in-effect` is turned on.
- Pages migrate one at a time, and the app works at every step.

## Non-goals

- Backend, API or socket.io protocol changes. Stations and connectors are
  untouched.
- Optimistic updates. Mutations keep working as they do today, including
  `useDeferredDelete` and undo toasts.
- Writing socket payloads directly into the cache. Events trigger a refetch.
- High-frequency pushed data such as `currentStations` and `currentTimeInfo`.
  These stay as subscriptions, which the rule doesn't flag.
- Suspense for data, or offline support.
- Session expiry handling. Today it's checked once, in `Layout`, and this spec
  doesn't change that.
- Rewriting all ~140 functions in `src/lib`. Only reads move.

## Options considered

React's docs list the same alternatives for apps without a framework: "consider
using or building a client-side cache", naming TanStack Query, useSWR and React
Router, and they allow staying with Effects if none suit.

| Option | Size (min + gzip) | For | Against |
|---|---|---|---|
| **TanStack Query 5** | 10.6 KB | Keys handle stale responses, sharing, retries and prefix invalidation, which suits socket events | New dependency; a new concept for contributors |
| SWR 2 | 6.4 KB | Smaller, similar model | Weaker fit for invalidating groups of data; less control over retries and cache lifetime. Not prototyped, so a close second |
| In-repo `useFetch` hook | Small | No dependency | Would rebuild sharing, retries and invalidation by hand, and we'd maintain them. Fixes the rule but not most of the problems |
| React Router loaders | None | Router already in use | Tied to navigation; no good fit for socket-driven refetching or data shared by layouts |
| Leave as is | None | No work | Every problem above stays, and the rule stays off |

Sizes are measured with esbuild for the APIs this spec uses, with React
external. The frontend's JavaScript is about 740 KB gzipped across all chunks.

**Recommendation: TanStack Query.** About 85 effects and these problems are too
much for a small hook, and a hook that solved them would be this library again.
The package supports React 18, which the frontend uses.

## Design

### Query client

One `QueryClient`, provided in `App.tsx`, with these defaults:

| Option | Value | Why |
|---|---|---|
| `networkMode` | `"always"` | The default pauses requests when the browser thinks it's offline. Venue networks are unusual, so always attempt the request and let it fail |
| `staleTime` | `0` (default) | Pages fetch on mount today; keep that |
| `retry` | `2` | Rides out short network drops. Today there are no retries |
| `refetchOnWindowFocus` | `false` | Avoids a jump in requests from every panel open at a venue. Can be revisited |
| `refetchOnReconnect` | `false` | Off in `"always"` mode. Socket reconnects drive this instead |

### Reading data

Reads go through a new `requestJson` helper, which throws a `RequestError` with
the HTTP status when a response isn't OK. Existing functions that return a
status keep working for mutations and unmigrated pages.

Each area of `src/lib` exports its query options, so keys live in one place:

```ts
export const roomQueries = {
    all: () =>
        queryOptions({
            queryKey: ["rooms"],
            queryFn: () => requestJson<Room[]>("competition/rooms"),
        }),
};

const { data: rooms, error } = useQuery(roomQueries.all());
```

Keys are nested by area (`["results", roundId, search]`), so invalidating
`["results"]` covers every results query.

Debounced searches use a small `useDebouncedValue` hook. The debounced value
goes in the key, with `keepPreviousData` so the list doesn't blank while typing.

### Socket rooms

A shared `useSocketRoom` hook replaces each page's join, leave, on and off
effect:

```ts
useSocketRoom({
    join: () => socket.emit("joinResults", { roundId }),
    leave: () => socket.emit("leaveResults", { roundId }),
    invalidateOn: { resultEntered: ["results", roundId] },
    enabled: !!roundId,
});
```

It rejoins on every connect and always removes its listeners. Its dependencies
don't include the search text, so typing doesn't leave the room.

`Layout` and `PublicLayout` call `queryClient.invalidateQueries()` on every
reconnect. That refetches everything on screen, closing the reconnect gap in
one place instead of on each page. Pages can drop the connection counter from
`SocketContext` as they migrate, and it's removed once nothing reads it.

### Errors and loading

- First load with no data: the existing loading state.
- First load failed: a shared inline error with a "Try again" button, in the
  user's task language.
- Refetch failed with data on screen: keep the data and show a small "Couldn't
  refresh" notice.

### Mutations

Mutations keep calling their `src/lib` functions and showing their toasts. Where
a page refetches today, it calls `invalidateQueries` with the relevant key
instead of receiving a `fetchData` prop. `useMutation` isn't required.

### Shared state

`competitionAtom` stays during the migration, because 35 files read it. It gets a
success check straight away. Whether it becomes a query is an open question.

### Tests

The 15 test files that mock `src/lib` keep working once wrapped in a test
`QueryClientProvider` with retries off, via a shared render helper. Existing
Playwright tests cover the migrated pages end to end.

### Migration

Each step is a separate PR, and pages can be migrated in any order after step 1.

1. **Foundation:** the client, `requestJson`, `useSocketRoom`, the error
   component, the test helper, and the `competitionAtom` check. Reconnect
   invalidation goes in here.
2. **Proof:** `Settings`, `Users` and `UnofficialEvents`, which are simple
   fetch-on-mount pages. Stop here and review before going further.
3. **Lists and search:** the incident lists, `AssignCards`, `Persons`, `CheckIn`.
4. **Live pages:** `Results`, `Attendance`, `Devices`, `Home`, the public pages.
   These matter most on competition day, so they go last, one per PR.
5. **Clean-up:** remaining findings, remove the connection counter, turn on
   `set-state-in-effect`.

### Competition day

A page mid-migration behaves like the rest of the app, so migrating in steps adds
no new failure mode. Requests keep failing visibly when the backend can't be
reached, and data on screen stays there. No live-page migration should merge
shortly before a competition.

Stations talk to the backend through the connector, so this doesn't affect
timing or attempt recording.

## Acceptance criteria

- Pages using `useQuery` show the newest request's data when responses return out
  of order. Unit test.
- A failed refetch leaves existing data on screen and shows the notice. Unit
  test. The docs reviewed for this spec don't state this behaviour, so prove it
  in step 1 before relying on it.
- A failed first load shows the error and "Try again" works. Unit test.
- `useSocketRoom` rejoins on connect and leaves no listeners after unmount. Unit
  test.
- After a socket reconnect, `Home` and `Results` show a result entered during the
  disconnect. Playwright test.
- With the browser's offline flag set but the backend reachable, data still loads.
  Manual check of `networkMode`.
- Typing in `Results` search sends no leave or join events. Unit test.
- Components mounted together that need rooms cause one request, not one each.
  Unit test.
- `set-state-in-effect` is on and `npm run lint` passes.
- No `useEffect` calls a read function from `src/lib`.

## Decisions

Answers to the open questions, agreed when the spec was accepted.

1. **New dependency:** accepted. TanStack Query is added.
2. **`competitionAtom`:** stays an atom for now, with a success check added in
   step 1. Whether it becomes a query is decided after step 3.
3. **`staleTime` for rooms and competition data:** 30 seconds, so components
   and pages that need them within that window share one request. No socket
   event announces changes to rooms or competition data, so a change made on
   another device appears on the next fetch after that window, or after a
   reconnect. Changes made in this panel invalidate the data straight away.
   Revisit if that delay causes problems.
4. **Refetch on window focus:** off. Revisit once reconnect invalidation is in.
5. **401 from a query:** a follow-up after this spec, not part of it.
