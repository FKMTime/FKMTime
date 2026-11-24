import { H2hSide, H2hStage, STAGE_LABELS } from "@/lib/h2h";
import {
    PublicH2hEntrant,
    PublicH2hMatch,
    PublicH2hPoint,
    PublicH2hSet,
    PublicH2hView,
} from "@/lib/h2hPublic";

/** A side: a seed, or the winner (w) or loser (l) of an earlier match */
type Slot = number | { w: number } | { l: number };

const toSide = (slot: Slot): H2hSide =>
    typeof slot === "number"
        ? { entrantId: `e${slot}`, source: null }
        : "w" in slot
          ? {
                entrantId: null,
                source: { matchNumber: slot.w, outcome: "WINNER" },
            }
          : {
                entrantId: null,
                source: { matchNumber: slot.l, outcome: "LOSER" },
            };

const STAGES_OF: Record<number, H2hStage[]> = {
    4: ["SEMIFINAL", "THIRD_PLACE", "FINAL"],
    8: ["QUARTERFINAL", "SEMIFINAL", "THIRD_PLACE", "FINAL"],
    12: ["STAGE_OF_12", "QUARTERFINAL", "SEMIFINAL", "THIRD_PLACE", "FINAL"],
    16: ["STAGE_OF_16", "QUARTERFINAL", "SEMIFINAL", "THIRD_PLACE", "FINAL"],
};

/**
 * The matches of each bracket size as the backend builds them (I2c, I2f):
 * stage, then side A and side B
 */
const MATCHES_OF: Record<number, [H2hStage, Slot, Slot][]> = {
    4: [
        ["SEMIFINAL", 1, 4],
        ["SEMIFINAL", 2, 3],
        ["THIRD_PLACE", { l: 2 }, { l: 1 }],
        ["FINAL", { w: 1 }, { w: 2 }],
    ],
    12: [
        ["STAGE_OF_12", 8, 9],
        ["STAGE_OF_12", 5, 12],
        ["STAGE_OF_12", 6, 11],
        ["STAGE_OF_12", 7, 10],
        ["QUARTERFINAL", 1, { w: 1 }],
        ["QUARTERFINAL", 4, { w: 2 }],
        ["QUARTERFINAL", 3, { w: 3 }],
        ["QUARTERFINAL", 2, { w: 4 }],
        ["SEMIFINAL", { w: 5 }, { w: 6 }],
        ["SEMIFINAL", { w: 7 }, { w: 8 }],
        ["THIRD_PLACE", { l: 10 }, { l: 9 }],
        ["FINAL", { w: 9 }, { w: 10 }],
    ],
    16: [
        ["STAGE_OF_16", 1, 16],
        ["STAGE_OF_16", 8, 9],
        ["STAGE_OF_16", 5, 12],
        ["STAGE_OF_16", 4, 13],
        ["STAGE_OF_16", 6, 11],
        ["STAGE_OF_16", 3, 14],
        ["STAGE_OF_16", 7, 10],
        ["STAGE_OF_16", 2, 15],
        ["QUARTERFINAL", { w: 1 }, { w: 2 }],
        ["QUARTERFINAL", { w: 3 }, { w: 4 }],
        ["QUARTERFINAL", { w: 5 }, { w: 6 }],
        ["QUARTERFINAL", { w: 7 }, { w: 8 }],
        ["SEMIFINAL", { w: 9 }, { w: 10 }],
        ["SEMIFINAL", { w: 11 }, { w: 12 }],
        ["THIRD_PLACE", { l: 14 }, { l: 13 }],
        ["FINAL", { w: 13 }, { w: 14 }],
    ],
};

export const entrant = (seed: number): PublicH2hEntrant => ({
    id: `e${seed}`,
    seed,
    name: `Competitor ${seed}`,
    countryIso2: "PL",
    registrantId: 100 + seed,
    bestSingle: null,
    position: null,
    stageReached: null,
});

/** A fresh bracket of this size: every seed in, nothing played */
export const buildView = (size: 4 | 12 | 16): PublicH2hView => {
    const matches: PublicH2hMatch[] = MATCHES_OF[size].map(
        ([stage, a, b], i) => {
            const inStage = MATCHES_OF[size].filter(([s]) => s === stage);
            const index = MATCHES_OF[size]
                .slice(0, i + 1)
                .filter(([s]) => s === stage).length;
            const sideA = toSide(a);
            const sideB = toSide(b);
            return {
                id: `m${i + 1}`,
                matchNumber: i + 1,
                label:
                    inStage.length === 1
                        ? STAGE_LABELS[stage]
                        : `${STAGE_LABELS[stage]} ${index}`,
                stage,
                setsToWin: 1,
                status:
                    sideA.entrantId && sideB.entrantId ? "READY" : "WAITING",
                winnerSide: null,
                endedBy: null,
                sideA,
                sideB,
                score: { a: 0, b: 0 },
                sets: [],
            };
        }
    );
    return {
        roundId: "333oh-r2",
        size,
        status: "SEEDED",
        stages: STAGES_OF[size].map((stage) => ({
            stage,
            label: STAGE_LABELS[stage],
            setsToWin: 1,
        })),
        entrants: Array.from({ length: size }, (_, i) => entrant(i + 1)),
        matches,
    };
};

/** A decided point; times in centiseconds */
export const point = (
    pointNumber: number,
    a: number,
    b: number,
    winnerSide: "A" | "B" | null = a < b ? "A" : b < a ? "B" : null
): PublicH2hPoint => ({
    pointNumber,
    winnerSide,
    decided: true,
    a: { value: a, penalty: 0 },
    b: { value: b, penalty: 0 },
    extraGranted: false,
});

export const set = (
    setNumber: number,
    points: PublicH2hPoint[],
    winnerSide: "A" | "B" | null = null
): PublicH2hSet => ({
    setNumber,
    winnerSide,
    decidedBy: winnerSide ? "POINTS" : null,
    points,
});

/** The view with one match replaced */
export const withMatch = (
    view: PublicH2hView,
    matchNumber: number,
    change: Partial<PublicH2hMatch>
): PublicH2hView => ({
    ...view,
    matches: view.matches.map((m) =>
        m.matchNumber === matchNumber ? { ...m, ...change } : m
    ),
});
