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
                "flex flex-col gap-3.5 rounded-mobile-card bg-card md:rounded-2xl",
                hasIncident
                    ? "border-2 border-destructive p-[15px]"
                    : "border p-4",
                className
            )}
        >
            <div className="flex min-h-[22px] flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-muted-foreground">
                    {deviceName}
                </span>
                {roundLabel && (
                    <span className="flex h-[22px] items-center whitespace-nowrap rounded-md border px-2 text-xs font-semibold text-muted-foreground">
                        {roundLabel}
                    </span>
                )}
                {hasIncident && (
                    <span className="flex h-[22px] items-center gap-1 rounded-md bg-destructive px-2 text-xs font-semibold text-destructive-foreground">
                        <TriangleAlert className="size-3.5" />
                        Incident
                    </span>
                )}
            </div>
            <div className="flex min-w-0 items-center gap-2.5">
                <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-muted-foreground"
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
            <div className="flex min-h-[66px] flex-col items-center justify-center gap-0.5">
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
            {cumulative && (
                <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5 border-t pt-2.5 text-xs text-muted-foreground">
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
