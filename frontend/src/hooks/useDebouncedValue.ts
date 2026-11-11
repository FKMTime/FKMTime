import { useEffect, useState } from "react";

/**
 * The value as it was `delay` ms after it last changed. The first value is
 * returned straight away, so only later changes wait.
 */
export const useDebouncedValue = <T>(value: T, delay: number) => {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timeout = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timeout);
    }, [value, delay]);
    return debounced;
};
