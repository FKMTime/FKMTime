import { ChevronLeft, ChevronRight } from "lucide-react";
import { ReactNode, useMemo } from "react";
import { Competition as WCIF } from "wcif-helpers";

import { Button } from "@/Components/ui/button";
import { useIsMobile } from "@/hooks/useMobile";
import { getEventName, getEventShortName } from "@/lib/events";
import { getScheduledRounds } from "@/lib/roundOptions";
import { cn, shortRoundName } from "@/lib/utils";

import EventChips from "./EventChips";
import RoundFinder from "./RoundFinder";
import ScheduleTimeline from "./ScheduleTimeline";
import SegmentedControl from "./SegmentedControl";
import { StatusDot } from "./StatusBadge";

interface RoundPickerProps {
    wcif: WCIF;
    /** Rounds in progress somewhere: marked live, and opened on event pick */
    liveRoundIds: string[];
    /** Selected round id, or "" for none */
    value: string;
    onValueChange: (roundId: string) => void;
    /** Adds a first option that clears the round, e.g. "All rounds" */
    clearLabel?: string;
    /** On desktop, every round on one row in schedule order */
    timeline?: boolean;
    /** Previous/next round of the schedule */
    steps?: boolean;
    /** Small marker after a round, e.g. its WCA live results state */
    getMarker?: (roundId: string) => ReactNode;
    className?: string;
}

const roundNumber = (roundId: string) => roundId.split("-r")[1];

interface StepButtonProps {
    roundId?: string;
    direction: "Previous" | "Next";
    onValueChange: (roundId: string) => void;
    className?: string;
}

const StepButton = ({
    roundId,
    direction,
    onValueChange,
    className,
}: StepButtonProps) => (
    <Button
        variant="outline"
        size="icon"
        className={cn("shrink-0", className)}
        aria-label={
            roundId
                ? `${direction} round: ${shortRoundName(roundId)}`
                : `${direction} round`
        }
        title={roundId ? shortRoundName(roundId) : undefined}
        disabled={!roundId}
        onClick={() => roundId && onValueChange(roundId)}
    >
        {direction === "Previous" ? <ChevronLeft /> : <ChevronRight />}
    </Button>
);

/**
 * Desktop: a finder for any round, beside the schedule as one row.
 * Phones: an event dropdown, then the event's rounds.
 */
const RoundPicker = ({
    wcif,
    liveRoundIds,
    value,
    onValueChange,
    clearLabel,
    timeline,
    steps,
    getMarker,
    className,
}: RoundPickerProps) => {
    const isMobile = useIsMobile();
    const scheduled = useMemo(() => getScheduledRounds(wcif), [wcif]);
    const events = wcif.events;

    // With no round picked, "next" opens the first round of the schedule
    const index = scheduled.findIndex((r) => r.roundId === value);
    const previous = index > 0 ? scheduled[index - 1].roundId : undefined;
    const next = scheduled[index + 1]?.roundId;
    const stepButton = (
        roundId: string | undefined,
        direction: "Previous" | "Next",
        buttonClassName?: string
    ) =>
        steps && (
            <StepButton
                roundId={roundId}
                direction={direction}
                onValueChange={onValueChange}
                className={buttonClassName}
            />
        );

    if (!isMobile) {
        const finder = (
            <RoundFinder
                events={events}
                liveRoundIds={liveRoundIds}
                value={value}
                onValueChange={onValueChange}
                clearLabel={clearLabel}
                compact={timeline}
                className={timeline ? "min-w-[150px]" : undefined}
            />
        );
        if (!timeline && !steps)
            return <div className={className}>{finder}</div>;
        return (
            <div className={cn("flex items-stretch gap-2", className)}>
                {finder}
                {stepButton(previous, "Previous", "md:h-auto")}
                {timeline && (
                    <ScheduleTimeline
                        rounds={scheduled}
                        timezone={wcif.schedule?.venues[0]?.timezone}
                        liveRoundIds={liveRoundIds}
                        value={value}
                        onValueChange={onValueChange}
                        getMarker={getMarker}
                    />
                )}
                {stepButton(next, "Next", "md:h-auto")}
            </div>
        );
    }

    const eventId = value ? value.split("-")[0] : "";
    const event = events.find((e) => e.id === eventId);

    const pickEvent = (id: string) => {
        if (!id) return onValueChange("");
        if (id === eventId) return;
        const rounds = events.find((e) => e.id === id)?.rounds ?? [];
        const live = rounds.find((r) => liveRoundIds.includes(r.id));
        const target = live ?? rounds[0];
        if (target) onValueChange(target.id);
    };

    return (
        <div className={cn("flex flex-col gap-3", className)}>
            <div className="flex items-start gap-2">
                {stepButton(previous, "Previous", "size-12")}
                <EventChips
                    className="min-w-0 flex-1"
                    value={eventId}
                    onValueChange={pickEvent}
                    events={[
                        ...(clearLabel
                            ? [{ id: "", label: clearLabel, name: clearLabel }]
                            : []),
                        ...events.map((e) => ({
                            id: e.id,
                            label: getEventShortName(e.id) || e.id,
                            name: getEventName(e.id) || e.id,
                            live: e.rounds.some((r) =>
                                liveRoundIds.includes(r.id)
                            ),
                        })),
                    ]}
                />
                {stepButton(next, "Next", "size-12")}
            </div>
            {event && event.rounds.length > 1 && (
                <SegmentedControl
                    label="Round"
                    fullWidth
                    value={value}
                    onValueChange={onValueChange}
                    options={event.rounds.map((r) => ({
                        value: r.id,
                        ariaLabel: `Round ${roundNumber(r.id)}${liveRoundIds.includes(r.id) ? ", live" : ""}`,
                        label: (
                            <>
                                Round {roundNumber(r.id)}
                                {liveRoundIds.includes(r.id) && (
                                    <StatusDot tone="primary" />
                                )}
                                {getMarker?.(r.id)}
                            </>
                        ),
                    }))}
                />
            )}
        </div>
    );
};

export default RoundPicker;
