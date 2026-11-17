import { useEffect, useState } from "react";

/** The current time, updated every `intervalMs` */
export const useNow = (intervalMs = 30_000) => {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), intervalMs);
        return () => clearInterval(interval);
    }, [intervalMs]);
    return now;
};
