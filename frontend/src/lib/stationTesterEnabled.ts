/**
 * The station tester is in the dev build, and in a build made with
 * VITE_STATION_TESTER=true, which only PR previews set. Both are read at
 * build time, so any other production bundle doesn't contain the page.
 */
export const STATION_TESTER_ENABLED =
    import.meta.env.DEV || import.meta.env.VITE_STATION_TESTER === "true";
