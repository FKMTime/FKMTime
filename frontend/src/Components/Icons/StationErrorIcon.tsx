import { Info, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/Components/ui/popover";
import { StationLastError } from "@/lib/interfaces";
import { STATION_ERROR_TTL_MS, stationErrorHint } from "@/lib/stationErrors";
import { cn } from "@/lib/utils";

const ago = (at: string, now: number) => {
    const minutes = Math.floor((now - Date.parse(at)) / 60_000);
    if (minutes < 1) return "Just now";
    return `${minutes} min ago`;
};

/** The current time, every 30 s: enough for "4 min ago" and the expiry */
const useNow = () => {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 30_000);
        return () => clearInterval(interval);
    }, []);
    return now;
};

interface StationErrorIconProps {
    lastError: StationLastError | null | undefined;
    className?: string;
}

/**
 * A station's last error, with what to do about it in a popover: delegates
 * mostly use phones, where tooltips don't open (SPEC-010)
 */
const StationErrorIcon = ({ lastError, className }: StationErrorIconProps) => {
    const now = useNow();
    if (!lastError) return null;
    // The backend's clear may not have arrived yet
    if (now - Date.parse(lastError.at) >= STATION_ERROR_TTL_MS) return null;

    const isProblem = lastError.kind === "problem";
    const Icon = isProblem ? TriangleAlert : Info;
    const hint = stationErrorHint(lastError);
    const details = [ago(lastError.at, now), lastError.competitorName]
        .filter(Boolean)
        .join(" · ");
    return (
        <Popover>
            <PopoverTrigger
                type="button"
                aria-label={lastError.message}
                className={cn(
                    "inline-flex shrink-0 items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isProblem ? "text-destructive" : "text-muted-foreground",
                    className
                )}
            >
                <Icon className="size-5" strokeWidth={2.25} aria-hidden />
            </PopoverTrigger>
            {/* From the icon's left edge: centred, it hangs over the sidebar.
                Rendered inside the name cell, so it resets the cell's no-wrap
                and bold text */}
            <PopoverContent
                align="start"
                collisionPadding={12}
                className="flex flex-col gap-1.5 whitespace-normal text-sm font-normal"
            >
                <p className="font-semibold">
                    {lastError.message}
                    {lastError.count > 1 && (
                        <span className="font-normal text-muted-foreground">
                            {" "}
                            ×{lastError.count}
                        </span>
                    )}
                </p>
                {hint && <p>{hint}</p>}
                <p className="text-xs text-muted-foreground">{details}</p>
            </PopoverContent>
        </Popover>
    );
};

export default StationErrorIcon;
