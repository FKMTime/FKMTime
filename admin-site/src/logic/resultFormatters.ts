export const inputToAttemptResult = (input: string) => {
  const num = toInt(input.replace(/\D/g, "")) || 0;
  return (
    Math.floor(num / 1000000) * 360000 +
    Math.floor((num % 1000000) / 10000) * 6000 +
    Math.floor((num % 10000) / 100) * 100 +
    (num % 100)
  );
};

export const resultToString = (result: number) => {
  if (result === -1) {
    return "DNF";
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
