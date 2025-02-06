import { Competition as WCIF } from "@wca/helpers";
import { getRoundInfoFromWcif } from "wcif-helpers";

import { activityCodeToName } from "./activities";
import { getUsualExtraScramblesCount, getUsualScramblesCount } from "./events";
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
export const validateScrambles = (
    wcifWithScrambles: WCIF,
    competitionWCIF: WCIF,
    additional?: boolean
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

export const addScrambles = async (
    roundId: string,
    wcif: WCIF,
    startFrom: number
) => {
    const transformedData = addToSet(roundId, wcif, startFrom);
    const response = await backendRequest(`scramble-set/import`, "POST", true, {
        scrambleSets: transformedData,
    });
    return {
        status: response.status,
        data: await response.json(),
    };
};

const addToSet = (roundId: string, wcif: WCIF, startFrom: number) => {
    const transformedData = transformScramblesData(wcif);
    const filteredData = transformedData.filter(
        (set) => set.roundId.split("-")[0] === roundId.split("-")[0]
    );
    const dataToReturn = [];
    let i = startFrom;
    for (const set of filteredData) {
        dataToReturn.push({
            ...set,
            set: numberToLetter(i),
        });
        i++;
    }
    return dataToReturn;
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
