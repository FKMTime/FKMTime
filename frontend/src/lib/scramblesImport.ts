import { Competition as WCIF, Round } from "wcif-helpers";
import { getRoundInfoFromWcif } from "wcif-helpers";

import { activityCodeToName } from "./activities";
import { getUsualExtraScramblesCount, getUsualScramblesCount } from "./events";
import { H2hPlanRow } from "./h2h";
import { ImportedScramble, ImportedScrambleSet } from "./interfaces";
import { backendRequest } from "./request";
import { numberToLetter } from "./utils";

export const removeUnusedScramblesFromWcif = (
    scramblesWcif: WCIF,
    competitionWcif: WCIF
) => {
    const events = competitionWcif.events.map((event) => event.id);
    return {
        ...scramblesWcif,
        events: scramblesWcif.events.filter((event) =>
            events.includes(event.id)
        ),
    };
};
/** A head-to-head round's scramble plan rows, in plan order */
export type H2hPlans = Record<
    string,
    Pick<H2hPlanRow, "matchLabel" | "setNumber">[] | undefined
>;

/** Normal scrambles a set needs so that a 3–2 set doesn't reach its extras */
const H2H_SCRAMBLES_PER_SET = 5;

/**
 * The checks for a head-to-head round (SPEC-001), instead of the usual set
 * counts: its sets are raced one per set of a match, as the plan says
 */
const validateH2hRound = (
    round: Round,
    roundWithScrambles: Round,
    plan: H2hPlans[string],
    additional: boolean | undefined
) => {
    const warnings: string[] = [];
    const errors: string[] = [];
    const name = activityCodeToName(round.id);
    const sets = roundWithScrambles.scrambleSets ?? [];
    if (sets.length === 0) {
        errors.push(`There are no scramble sets for ${name}`);
        return { warnings, errors };
    }
    if (plan && !additional && sets.length < plan.length) {
        const leftOver = plan
            .slice(sets.length)
            .map((row) => `${row.matchLabel} set ${row.setNumber}`);
        warnings.push(
            `There are ${sets.length} scramble sets for ${name} but its bracket plans ${plan.length}. These have no set yet: ${leftOver.join(", ")}`
        );
    }
    sets.forEach((set, i) => {
        if (set.scrambles.length < H2H_SCRAMBLES_PER_SET) {
            warnings.push(
                `${name} Set ${numberToLetter(i + 1)} has ${set.scrambles.length} scrambles, fewer than ${H2H_SCRAMBLES_PER_SET}, so a set that goes to 3–2 would use its extras`
            );
        }
    });
    return { warnings, errors };
};

export const validateScrambles = (
    wcifWithScrambles: WCIF,
    competitionWCIF: WCIF,
    additional?: boolean,
    h2hPlans: H2hPlans = {}
) => {
    const warnings: string[] = [];
    const errors: string[] = [];
    competitionWCIF.events.forEach((event) => {
        event.rounds.forEach((round) => {
            const roundWithScrambles = getRoundInfoFromWcif(
                round.id,
                wcifWithScrambles
            );
            if (!roundWithScrambles && !additional) {
                warnings.push(
                    `There are no scrambles for ${activityCodeToName(round.id)}`
                );
            }
            roundWithScrambles?.scrambleSets?.forEach((set, i: number) => {
                const unecryptedScrambles = set.scrambles.some((scramble) =>
                    scramble.includes(" ")
                );
                if (unecryptedScrambles) {
                    errors.push(
                        `${activityCodeToName(
                            round.id
                        )} Set ${numberToLetter(i + 1)} contains unencrypted scrambles`
                    );
                }
            });
            if (round.format === "h") {
                if (roundWithScrambles) {
                    const h2h = validateH2hRound(
                        round,
                        roundWithScrambles,
                        h2hPlans[round.id],
                        additional
                    );
                    warnings.push(...h2h.warnings);
                    errors.push(...h2h.errors);
                }
                return;
            }
            if (
                roundWithScrambles?.scrambleSets &&
                roundWithScrambles?.scrambleSets.length !==
                    round.scrambleSetCount &&
                !additional
            ) {
                warnings.push(
                    `There are ${roundWithScrambles?.scrambleSets.length} scramble sets for ${activityCodeToName(
                        round.id
                    )} but ${round.scrambleSetCount} were expected`
                );
            }
            const usualScramblesCount = getUsualScramblesCount(event.id);
            const extraScramblesCount = getUsualExtraScramblesCount(event.id);

            if (
                roundWithScrambles?.scrambleSets &&
                roundWithScrambles?.scrambleSets.some(
                    (set) => set.scrambles.length !== usualScramblesCount
                ) &&
                !additional
            ) {
                warnings.push(
                    `There are some sets with a different number of scrambles than usual for ${activityCodeToName(
                        round.id
                    )}. Please ensure that this is intentional (e. g. BoX format is used instead of Ao5)`
                );
            }

            if (
                roundWithScrambles?.scrambleSets &&
                roundWithScrambles?.scrambleSets.some(
                    (set) => set.extraScrambles.length !== extraScramblesCount
                ) &&
                !additional
            ) {
                warnings.push(
                    `There are some sets with a different number of extra scrambles than usual for ${activityCodeToName(
                        round.id
                    )}. Please ensure that this is intentional`
                );
            }
        });
    });
    return {
        warnings,
        errors,
    };
};

export const importScrambles = async (wcif: WCIF) => {
    const transformedData = transformScramblesData(wcif);
    const response = await backendRequest("scramble-set/import", "POST", true, {
        scrambleSets: transformedData,
    });
    return {
        status: response.status,
        data: await response.json(),
    };
};

export const addScrambles = async (scrambleSets: ImportedScrambleSet[]) => {
    const response = await backendRequest(`scramble-set/import`, "POST", true, {
        scrambleSets,
    });
    return {
        status: response.status,
        data: await response.json(),
    };
};

/**
 * Sets to add to `roundId` from a scramble file: the file's Round 1 sets of
 * the same event, moved to `roundId` and lettered from `startFrom`.
 */
export const getScrambleSetsToAdd = (
    roundId: string,
    wcif: WCIF,
    startFrom: number
): ImportedScrambleSet[] => {
    const sourceRoundId = `${roundId.split("-")[0]}-r1`;
    return transformScramblesData(wcif)
        .filter((set) => set.roundId === sourceRoundId)
        .map((set, i) => ({
            ...set,
            roundId,
            set: numberToLetter(startFrom + i),
        }));
};

const transformScramblesData = (wcif: WCIF) => {
    const scrambleSets: ImportedScrambleSet[] = [];
    wcif.events.forEach((event) => {
        event.rounds.forEach((round) => {
            if (!round.scrambleSets) return;
            round.scrambleSets.forEach((set, i: number) => {
                const combinedScrambles: ImportedScramble[] = [];
                set.scrambles.forEach((scramble, j: number) => {
                    combinedScrambles.push({
                        num: j + 1,
                        encryptedScramble: scramble,
                        isExtra: false,
                    });
                });
                set.extraScrambles.forEach((scramble, j: number) => {
                    combinedScrambles.push({
                        num: j + 1,
                        encryptedScramble: scramble,
                        isExtra: true,
                    });
                });
                scrambleSets.push({
                    roundId: round.id,
                    set: numberToLetter(i + 1),
                    scrambles: combinedScrambles,
                });
            });
        });
    });
    return scrambleSets;
};
