import * as React from "react";

const MOBILE_BREAKPOINT = 768;

const subscribe = (onChange: () => void) => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
};

const isBelowBreakpoint = () => window.innerWidth < MOBILE_BREAKPOINT;

export function useIsMobile() {
    return React.useSyncExternalStore(subscribe, isBelowBreakpoint);
}
