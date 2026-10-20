import { useIsSocketDown } from "@/hooks/useSocketStatus";
import { cn } from "@/lib/utils";

import { StatusDot } from "./StatusBadge";

/**
 * Amber "Reconnecting…" pill, shown only while the live connection is down.
 * Pages refetch on reconnect, so nothing else needs doing.
 */
const ConnectionStatus = ({ className }: { className?: string }) => {
    const isDown = useIsSocketDown();
    if (!isDown) return null;
    return (
        <span
            role="status"
            title="Live updates are paused until the connection is back. Data on screen may be out of date."
            className={cn(
                "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-warning-soft px-2.5 text-xs font-semibold text-warning",
                className
            )}
        >
            <StatusDot tone="warning" className="animate-pulse" />
            Reconnecting…
        </span>
    );
};

export default ConnectionStatus;
