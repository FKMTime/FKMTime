import { CircleCheck, TriangleAlert, WifiOff } from "lucide-react";

import { StationPhase } from "@/lib/liveSolving";
import { cn, getInitials } from "@/lib/utils";

import { STATUS_TEXT, StatusTone } from "./status";
import { StatusLabel } from "./StatusBadge";

interface StationCardProps {
    deviceName: string;
    competitorName?: string | null;
    phase: StationPhase;
    /** Formatted time for the current phase, e.g. "12.34" */
    time?: string | null;
    /** Formatted cumulative time limit, e.g. remaining "3:12.00" of "5:00.00" */
    cumulative?: { remaining: string; limit: string } | null;
    /** Shown when a room runs more than one round */
    roundLabel?: string;
    /** Staff only: red border and badge */
    hasIncident?: boolean;
    className?: string;
}

const PHASES: Record<
    StationPhase,
    { label: string; tone: StatusTone; icon?: JSX.Element }
> = {
    idle: { label: "Waiting", tone: "neutral" },
    inspection: { label: "Inspection", tone: "warning" },
    solving: { label: "Solving", tone: "success" },
    finished: { label: "Finished", tone: "primary", icon: <CircleCheck /> },
    offline: { label: "Offline", tone: "neutral", icon: <WifiOff /> },
};

const StationCard = ({
    deviceName,
    competitorName,
    phase,
    time,
    cumulative,
    roundLabel,
    hasIncident,
    className,
}: StationCardProps) => {
    const { label, tone, icon } = PHASES[phase];
    const showTime = !!time && phase !== "idle" && phase !== "offline";

    return (
        <article
            aria-label={`${deviceName}: ${label}`}
            className={cn(
                "flex flex-col gap-2 rounded-mobile-card bg-card md:gap-3.5 md:rounded-2xl",
                hasIncident
                    ? "border-2 border-destructive px-[13px] py-[11px] md:p-[15px]"
                    : "border px-3.5 py-3 md:p-4",
                className
            )}
        >
            {/* Mobile: one row with the status on the right; desktop: stacked */}
            <div className="flex items-center gap-2.5 md:flex-col md:items-stretch md:gap-3.5">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 md:gap-3.5">
                    <div className="flex items-center gap-1.5 md:min-h-[22px] md:flex-wrap md:gap-2">
                        <span className="min-w-0 truncate text-xs font-semibold text-muted-foreground md:flex-1 md:text-[13px]">
                            {deviceName}
                        </span>
                        {roundLabel && (
                            <span className="hidden h-[22px] items-center whitespace-nowrap rounded-md border px-2 text-xs font-semibold text-muted-foreground md:flex">
                                {roundLabel}
                            </span>
                        )}
                        {hasIncident && (
                            <span className="flex h-5 items-center gap-1 rounded-md bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground md:h-[22px] md:px-2 md:text-xs">
                                <TriangleAlert className="size-3.5" />
                                Incident
                            </span>
                        )}
                    </div>
                    <div className="flex min-w-0 items-center gap-2.5">
                        <span
                            aria-hidden
                            className="hidden size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-muted-foreground md:flex"
                        >
                            {competitorName ? getInitials(competitorName) : "?"}
                        </span>
                        <span
                            className={cn(
                                "truncate text-[15px] font-semibold",
                                !competitorName && "text-muted-foreground"
                            )}
                        >
                            {competitorName ?? "No competitor"}
                        </span>
                    </div>
                    {roundLabel && (
                        <span className="text-xs text-muted-foreground md:hidden">
                            {roundLabel}
                        </span>
                    )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5 md:min-h-[66px] md:items-center md:justify-center">
                    <StatusLabel tone={tone} icon={icon}>
                        {label}
                    </StatusLabel>
                    {showTime && (
                        <span
                            className={cn(
                                "text-[26px] font-bold leading-tight tracking-[-0.01em] md:text-4xl",
                                phase === "finished"
                                    ? "text-foreground"
                                    : STATUS_TEXT[tone]
                            )}
                        >
                            {time}
                        </span>
                    )}
                </div>
            </div>
            {cumulative && (
                <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5 border-t pt-2 text-xs text-muted-foreground md:pt-2.5">
                    <span className="whitespace-nowrap">Cumulative limit</span>
                    <span className="whitespace-nowrap">
                        <b className="font-semibold text-foreground">
                            {cumulative.remaining}
                        </b>{" "}
                        / {cumulative.limit}
                    </span>
                </div>
            )}
        </article>
    );
};

export default StationCard;
