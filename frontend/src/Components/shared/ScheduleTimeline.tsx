import { useEffect, useRef } from "react";

import { useScrollFade } from "@/hooks/useScrollFade";
import { getEventIconClass } from "@/lib/events";
import { ScheduledRound } from "@/lib/roundOptions";
import { cn, shortRoundName } from "@/lib/utils";

import { StatusDot } from "./StatusBadge";

interface ScheduleTimelineProps {
    rounds: ScheduledRound[];
    /** Venue timezone, so times and days read as on the printed schedule */
    timezone?: string;
    liveRoundIds: string[];
    value: string;
    onValueChange: (roundId: string) => void;
    className?: string;
}

const dayOf = (startTime: string | undefined, timeZone?: string) =>
    startTime
        ? new Date(startTime).toLocaleDateString("en-GB", {
              weekday: "long",
              timeZone,
          })
        : "Not scheduled";

/** Calendar date at the venue, e.g. "2026-05-01", to group rounds by day */
const dateOf = (startTime: string | undefined, timeZone?: string) =>
    startTime
        ? new Date(startTime).toLocaleDateString("en-CA", { timeZone })
        : "";

const timeOf = (startTime: string, timeZone?: string) =>
    new Date(startTime).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
    });

/** One day of the schedule on a row: the selected round's, or today's */
const ScheduleTimeline = ({
    rounds,
    timezone,
    liveRoundIds,
    value,
    onValueChange,
    className,
}: ScheduleTimelineProps) => {
    const scrollRef = useScrollFade<HTMLDivElement>();
    const selectedRef = useRef<HTMLButtonElement>(null);
    // With nothing picked, show where the competition is now
    const anchorId =
        value || rounds.find((r) => liveRoundIds.includes(r.roundId))?.roundId;
    const anchor = rounds.find((r) => r.roundId === anchorId);
    const today = dateOf(new Date().toISOString(), timezone);
    const shownDate = anchor
        ? dateOf(anchor.startTime, timezone)
        : rounds.some((r) => dateOf(r.startTime, timezone) === today)
          ? today
          : dateOf(rounds[0]?.startTime, timezone);
    const dayRounds = rounds.filter(
        (r) => dateOf(r.startTime, timezone) === shownDate
    );

    useEffect(() => {
        const track = scrollRef.current;
        const item = selectedRef.current;
        if (!track || !item) return;
        // Scroll the track only, never the page
        track.scrollTo?.({
            left: item.offsetLeft - (track.clientWidth - item.offsetWidth) / 2,
            behavior: "smooth",
        });
    }, [anchorId, scrollRef]);

    return (
        <div
            ref={scrollRef}
            role="radiogroup"
            aria-label="Rounds by schedule"
            className={cn(
                "scroll-fade-x relative flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-xl bg-secondary p-1 scrollbar-none",
                className
            )}
        >
            <span className="shrink-0 px-2 text-[11px] font-bold uppercase tracking-wide text-faint">
                {dayOf(dayRounds[0]?.startTime, timezone)}
            </span>
            {dayRounds.map((round) => {
                const isSelected = round.roundId === value;
                const isLive = liveRoundIds.includes(round.roundId);
                return (
                    <button
                        key={round.roundId}
                        ref={
                            round.roundId === anchorId ? selectedRef : undefined
                        }
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={`${shortRoundName(round.roundId)}${isLive ? ", live" : ""}`}
                        onClick={() => onValueChange(round.roundId)}
                        className={cn(
                            "flex h-12 shrink-0 flex-col items-start justify-center gap-0.5 whitespace-nowrap rounded-[9px] px-3 text-left transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/40",
                            isSelected
                                ? "bg-card text-foreground shadow-segment"
                                : "text-muted-foreground hover:bg-accent"
                        )}
                    >
                        <span className="flex items-center gap-1.5 text-[13px] font-bold">
                            <span
                                aria-hidden
                                className={cn(
                                    "cubing-icon text-sm",
                                    getEventIconClass(
                                        round.roundId.split("-")[0]
                                    )
                                )}
                            />
                            {shortRoundName(round.roundId)}
                        </span>
                        <span
                            className={cn(
                                "flex items-center gap-1 text-[11px] font-semibold",
                                isLive ? "text-primary" : "text-faint"
                            )}
                        >
                            {isLive && <StatusDot tone="primary" />}
                            {isLive
                                ? "Live"
                                : round.startTime
                                  ? timeOf(round.startTime, timezone)
                                  : "—"}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

export default ScheduleTimeline;
