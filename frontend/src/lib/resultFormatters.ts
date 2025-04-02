import { DNF_VALUE, DNS_VALUE, SKIPPED_VALUE } from "./constants";
import { Attempt } from "./interfaces";

export const resultToString = (result: number) => {
    if (result === DNF_VALUE) {
        return "DNF";
    }
    if (result === DNS_VALUE) {
        return "DNS";
    }
    return centisecondsToClockFormat(result).toString();
};

export const centisecondsToClockFormat = (centiseconds: number) => {
    if (!Number.isFinite(centiseconds)) {
        throw new Error(
            `Invalid centiseconds, expected positive number, got ${centiseconds}.`
        );
    }
    return new Date(centiseconds * 10)
        .toISOString()
        .substr(11, 11)
        .replace(/^[0:]*(?!\.)/g, "");
};

export const milisecondsToClockFormat = (ms: number) => {
    const seconds = ms / 1000;
    if (seconds > 60) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        if (remainingSeconds < 10) {
            return `${minutes}:0${remainingSeconds.toFixed(3)}`;
        }
        return `${minutes}:${remainingSeconds.toFixed(3)}`;
    }
    return seconds.toFixed(3);
};

export const toInt = (string: string) => {
    const number = parseInt(string, 10);
    if (Number.isNaN(number)) return null;
    return number;
};

export const attemptWithPenaltyToString = (attempt: Attempt) => {
    if (attempt.penalty === DNF_VALUE) {
        return "DNF";
    }
    if (attempt.penalty === DNS_VALUE) {
        return "DNS";
    }
    if (attempt.value === SKIPPED_VALUE) {
        return "";
    }
    if (attempt.penalty === 0) {
        return resultToString(attempt.value);
    } else {
        return resultToString(attempt.value + attempt.penalty * 100);
    }
};

export const reformatInput = (input: string) => {
    const number = toInt(input.replace(/\D/g, "")) || 0;
    if (number === 0) return "";
    const str = "00000000" + number.toString().slice(0, 8);
    //eslint-disable-next-line
    //@ts-ignore
    const [, hh, mm, ss, cc] = str.match(/(\d\d)(\d\d)(\d\d)(\d\d)$/);
    return `${hh}:${mm}:${ss}.${cc}`.replace(/^[0:]*(?!\.)/g, "");
};

export const inputToAttemptResult = (input: string) => {
    if (input === "") return SKIPPED_VALUE;
    const num = toInt(input.replace(/\D/g, "")) || 0;
    return (
        Math.floor(num / 1000000) * 360000 +
        Math.floor((num % 1000000) / 10000) * 6000 +
        Math.floor((num % 10000) / 100) * 100 +
        (num % 100)
    );
};

export const attemptResultToInput = (attemptResult: number) => {
    if (attemptResult === SKIPPED_VALUE) return "";
    return centisecondsToClockFormat(attemptResult);
};

export const isValid = (input: string) => {
    return input === attemptResultToInput(inputToAttemptResult(input));
};

export const autocompleteTimeAttemptResult = (attemptResult: number) => {
    if (attemptResult <= 0) return attemptResult;
    if (attemptResult <= 10 * 6000) return attemptResult;
    return Math.round(attemptResult / 100) * 100;
};
