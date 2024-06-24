import { Round, RoundFormat } from "@wca/helpers";

import { CUTOFF_ALLOWED } from "@/logic/constants";

export const updateTimeLimitInRounds = (
    roundId: string,
    value: number,
    rounds: Round[]
) => {
    const newRounds = [...rounds];
    const round = newRounds.find((r) => r.id === roundId);
    if (!round) {
        return newRounds;
    }
    if (!round.timeLimit) {
        round.timeLimit = {
            centiseconds: value,
            cumulativeRoundIds: [],
        };
        return newRounds;
    } else {
        round.timeLimit.centiseconds = value;
    }
    return newRounds;
};

export const updateCutoffInRounds = (
    roundId: string,
    value: number,
    rounds: Round[]
) => {
    const newRounds = [...rounds];
    const round = newRounds.find((r) => r.id === roundId);
    if (!round) {
        return newRounds;
    }
    round.cutoff = {
        numberOfAttempts: round.format === "a" ? 2 : 1,
        attemptResult: value,
    };
    return newRounds;
};

export const updateFormatInRounds = (
    roundId: string,
    value: RoundFormat,
    rounds: Round[]
) => {
    const newRounds = [...rounds];
    const round = newRounds.find((r) => r.id === roundId);
    if (!round) {
        return newRounds;
    }
    round.format = value;
    if (round.cutoff) {
        if (!CUTOFF_ALLOWED.includes(value)) {
            round.cutoff = null;
        } else {
            round.cutoff.numberOfAttempts = value === "a" ? 2 : 1;
        }
    }
    return newRounds;
};

export const updateCumulativeLimit = (
    roundId: string,
    value: boolean,
    rounds: Round[]
) => {
    const newRounds = [...rounds];
    const round = newRounds.find((r) => r.id === roundId);
    if (!round) {
        return newRounds;
    }
    if (!round.timeLimit) {
        round.timeLimit = {
            centiseconds: 60000,
            cumulativeRoundIds: [],
        };
    }
    if (value) {
        round.timeLimit.cumulativeRoundIds.push(roundId);
    } else {
        round.timeLimit.cumulativeRoundIds = [];
    }
    return newRounds;
};
