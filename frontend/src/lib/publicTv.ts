import { playingMatches, PublicH2hView } from "@/lib/h2hPublic";

/** How long each TV slide stays up */
export const TV_SLIDE_MS = 15_000;

/** Rows shown per results slide, so a round fits on one screen */
export const TV_RESULT_ROWS = 10;

export type TvSlide =
    | { type: "live" }
    | { type: "results"; roundId: string }
    /** A head-to-head round between matches */
    | { type: "h2hBracket"; roundId: string }
    /** A head-to-head match being played */
    | { type: "h2hMatch"; roundId: string; matchNumber: number };

/** A head-to-head round in progress and the matches being played in it */
export interface TvH2hRound {
    roundId: string;
    playingMatchNumbers: number[];
}

/**
 * The head-to-head round in progress, known from the WCIF, so it never
 * falls back to a results slide. Until its bracket loads (or while it
 * fails to) it has no playing matches, and the TV shows its bracket slide.
 */
export const getTvH2hRounds = (
    h2hRoundId: string | null,
    view: Pick<PublicH2hView, "roundId" | "matches"> | undefined
): TvH2hRound[] =>
    h2hRoundId
        ? [
              {
                  roundId: h2hRoundId,
                  playingMatchNumbers:
                      view?.roundId === h2hRoundId
                          ? playingMatches(view).map(
                                (match) => match.matchNumber
                            )
                          : [],
              },
          ]
        : [];

/**
 * Live solving first, then each round in progress. A head-to-head round
 * shows its bracket instead of its results, ahead of live solving, so the
 * bracket is what comes up when a match ends. While one of its matches is
 * being played, that match's scoreboard replaces the whole rotation.
 * `h2hRoundIds` are all the competition's head-to-head rounds: the TV
 * follows only those in `h2hRounds`, and leaves any other out rather than
 * rank it as an ordinary round.
 */
export const getTvSlides = (
    liveRoundIds: string[],
    h2hRounds: TvH2hRound[] = [],
    h2hRoundIds: string[] = []
): TvSlide[] => {
    const playing = h2hRounds.flatMap(({ roundId, playingMatchNumbers }) =>
        playingMatchNumbers.map((matchNumber) => ({
            type: "h2hMatch" as const,
            roundId,
            matchNumber,
        }))
    );
    if (playing.length > 0) return playing;
    const isH2h = (roundId: string) =>
        h2hRounds.some((round) => round.roundId === roundId);
    return [
        ...liveRoundIds
            .filter(isH2h)
            .map((roundId) => ({ type: "h2hBracket" as const, roundId })),
        { type: "live" },
        ...liveRoundIds
            .filter(
                (roundId) => !isH2h(roundId) && !h2hRoundIds.includes(roundId)
            )
            .map((roundId) => ({ type: "results" as const, roundId })),
    ];
};

/** Next or previous slide, wrapping around; safe when the list shrank */
export const stepSlide = (index: number, count: number, step = 1) =>
    count === 0 ? 0 : (((index + step) % count) + count) % count;

/** Scale for a stage designed at 1280×720, never below 1 */
export const getTvZoom = (width: number, height: number) =>
    Math.max(1, Math.min(width / 1280, height / 720));
