import { Competition as WCIF } from "@wca/helpers";
import { getRoundInfoFromWcif } from "wcif-helpers";

import { activityCodeToName } from "./activities";
import { getUsualExtraScramblesCount, getUsualScramblesCount } from "./events";

export const getScramblesWarnings = (
    wcifWithScrambles: WCIF,
    competitionWCIF: WCIF
) => {
    const warnings: string[] = [];
    competitionWCIF.events.forEach((event) => {
        event.rounds.forEach((round) => {
            const roundWithScrambles = getRoundInfoFromWcif(
                round.id,
                wcifWithScrambles
            );
            if (!roundWithScrambles) {
                warnings.push(
                    `There are no scrambles for ${activityCodeToName(round.id)}`
                );
            }
            if (
                roundWithScrambles?.scrambleSets &&
                roundWithScrambles?.scrambleSets.length !==
                    round.scrambleSetCount
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
                )
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
                )
            ) {
                warnings.push(
                    `There are some sets with a different number of extra scrambles than usual for ${activityCodeToName(
                        round.id
                    )}. Please ensure that this is intentional`
                );
            }
        });
    });
    return warnings;
};
