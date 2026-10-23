/** "now", "4 min", "2 h", "2 h 15 min" since the given time */
export const formatElapsed = (since: Date | string, now = new Date()) => {
    const minutes = Math.floor(
        (now.getTime() - new Date(since).getTime()) / 60_000
    );
    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} h ${rest} min` : `${hours} h`;
};

/** "11:02" in the viewer's local time */
export const formatClockTime = (date: Date | string) =>
    new Date(date).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
    });

const formatDayMonthYear = (date: Date) =>
    date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    });

/**
 * "14 Nov 2026", "18–19 Apr 2026", "30 Apr – 2 May 2026" or
 * "30 Dec 2026 – 2 Jan 2027" for WCA competition dates (YYYY-MM-DD).
 */
export const formatDateRange = (start: string, end?: string) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : startDate;
    const endLabel = formatDayMonthYear(endDate);
    if (startDate.getTime() === endDate.getTime()) return endLabel;
    const sameYear = startDate.getUTCFullYear() === endDate.getUTCFullYear();
    const sameMonth =
        sameYear && startDate.getUTCMonth() === endDate.getUTCMonth();
    if (sameMonth) return `${startDate.getUTCDate()}–${endLabel}`;
    const startLabel = sameYear
        ? startDate.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              timeZone: "UTC",
          })
        : formatDayMonthYear(startDate);
    return `${startLabel} – ${endLabel}`;
};
