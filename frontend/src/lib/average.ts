import { attemptWithPenaltyToString } from "@/lib/resultFormatters";

import { DNF_VALUE, DNS_VALUE } from "./constants";
import { Attempt } from "./interfaces";

export const average = (attempts: Attempt[]) => {
    switch (attempts.length) {
        case 3:
            return roundOver10Mins(meanOf3(attempts));
        case 5:
            return roundOver10Mins(averageOf5(attempts));
    }
};

export const best = (attempts: Attempt[]) => {
    const sorted = attempts.slice().sort(compareAttemptResults);
    if (!sorted.some(isComplete)) return Number.MAX_VALUE;
    if (sorted.length === 0) return 0;
    return sorted[0].value;
};

export const formattedBest = (attempts: Attempt[]) => {
    const sorted = attempts.slice().sort(compareAttemptResults);
    if (sorted.length === 0) return "";
    return attemptWithPenaltyToString(sorted[0]);
};

const roundOver10Mins = (value: number) => {
    if (value <= 0) return value;
    if (value <= 10 * 6000) return value;
    return Math.round(value / 100) * 100;
};

const averageOf5 = (times: Attempt[]) => {
    const [, x, y, z] = times.slice().sort(compareAttemptResults);
    return meanOf3([x, y, z]);
};

function meanOf3(times: Attempt[]) {
    if (!times.every(isComplete)) return DNF_VALUE;
    return mean(times);
}

function mean(values: Attempt[]) {
    const times = values.map(
        (time: Attempt) => time.value + time.penalty * 100
    );
    const sum = times.reduce((x, y) => x + y, 0);
    return Math.round(sum / values.length);
}

const compareAttemptResults = (time: Attempt, time2: Attempt) => {
    if (!isComplete(time) && !isComplete(time2)) return 0;
    if (!isComplete(time) && isComplete(time2)) return 1;
    if (isComplete(time) && !isComplete(time2)) return DNF_VALUE;
    const fullTime1 =
        time.penalty === 0 ? time.value : time.value + time.penalty * 100;
    const fullTime2 =
        time2.penalty === 0 ? time2.value : time2.value + time2.penalty * 100;
    return fullTime1 - fullTime2;
};

const isComplete = (time: Attempt) => {
    return time.penalty !== DNF_VALUE && time.penalty !== DNS_VALUE;
};
