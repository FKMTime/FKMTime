/** How long each TV slide stays up */
export const TV_SLIDE_MS = 15_000;

/** Rows shown per results slide, so a round fits on one screen */
export const TV_RESULT_ROWS = 10;

export type TvSlide = { type: "live" } | { type: "results"; roundId: string };

/** Live solving first, then each round in progress */
export const getTvSlides = (liveRoundIds: string[]): TvSlide[] => [
    { type: "live" },
    ...liveRoundIds.map((roundId) => ({ type: "results" as const, roundId })),
];

/** Next or previous slide, wrapping around; safe when the list shrank */
export const stepSlide = (index: number, count: number, step = 1) =>
    count === 0 ? 0 : (((index + step) % count) + count) % count;

/** Scale for a stage designed at 1280×720, never below 1 */
export const getTvZoom = (width: number, height: number) =>
    Math.max(1, Math.min(width / 1280, height / 720));
