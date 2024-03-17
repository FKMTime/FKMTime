export const resultToString = (result: number) => {
    if (result === -1) {
        return "DNF";
    }
    if (result === -2) {
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

export const toInt = (string: string) => {
    const number = parseInt(string, 10);
    if (Number.isNaN(number)) return null;
    return number;
};
