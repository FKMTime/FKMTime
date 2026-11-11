import { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface RefreshingRegionProps {
    isRefreshing: boolean;
    children: ReactNode;
    className?: string;
}

/**
 * Keeps the current content on screen, dimmed, while the next round, group
 * or tab loads, instead of swapping the page for a spinner.
 */
const RefreshingRegion = ({
    isRefreshing,
    children,
    className,
}: RefreshingRegionProps) => (
    <div
        aria-busy={isRefreshing}
        className={cn(
            "transition-opacity",
            isRefreshing && "pointer-events-none opacity-50",
            className
        )}
    >
        {children}
    </div>
);

export default RefreshingRegion;
