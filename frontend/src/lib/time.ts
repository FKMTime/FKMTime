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
