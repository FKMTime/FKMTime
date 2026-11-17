/** Chips and breadcrumb the group pickers share */
import { Check, ChevronRight, Sparkles } from "lucide-react";

import ProgressBar from "@/Components/shared/ProgressBar";
import { StatusDot } from "@/Components/shared/StatusBadge";
import { shortGroupLabel } from "@/lib/currentGroups";
import { getEventIconClass } from "@/lib/events";
import { cn } from "@/lib/utils";

import {
    PickerEvent,
    PickerGroup,
    PickerRound,
    PickerStep,
} from "./pickerModel";

const hhmm = (iso: string, timeZone?: string) =>
    new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
    }).format(new Date(iso));

const chipClass = (isSelected?: boolean) =>
    cn(
        "flex min-w-0 flex-col items-start gap-0.5 rounded-lg border bg-card px-3 py-2 text-left text-sm transition-colors outline-none",
        "hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-card",
        isSelected &&
            "border-primary bg-primary-soft text-primary hover:bg-primary-soft"
    );

export const EventIcon = ({
    id,
    className,
}: {
    id: string;
    className?: string;
}) => (
    <span
        aria-hidden
        className={cn("cubing-icon", getEventIconClass(id), className)}
    />
);

export const EventChip = ({
    event,
    isSelected,
    onPick,
    compact,
}: {
    event: PickerEvent;
    isSelected?: boolean;
    onPick: () => void;
    compact?: boolean;
}) => (
    <button
        type="button"
        data-picker-chip
        title={event.name}
        aria-label={event.name}
        aria-pressed={isSelected}
        onClick={onPick}
        className={cn(
            chipClass(isSelected),
            "flex-row items-center gap-2",
            compact ? "py-1.5" : "py-2.5"
        )}
    >
        <EventIcon id={event.id} className="shrink-0 text-lg" />
        <span className="truncate font-semibold">{event.shortName}</span>
    </button>
);

export const RoundChip = ({
    round,
    timezone,
    isSelected,
    onPick,
}: {
    round: PickerRound;
    timezone?: string;
    isSelected?: boolean;
    onPick: () => void;
}) => {
    const { state } = round;
    return (
        <button
            type="button"
            data-picker-chip
            aria-pressed={isSelected}
            onClick={onPick}
            className={chipClass(isSelected)}
        >
            <span className="font-semibold">Round {round.number}</span>
            <span
                className={cn(
                    "flex items-center gap-1.5 text-xs",
                    state.kind === "running"
                        ? "text-primary"
                        : "text-muted-foreground"
                )}
            >
                {state.kind === "running" && (
                    <>
                        <StatusDot tone="primary" />
                        Running · {state.roomNames.join(", ")}
                    </>
                )}
                {state.kind === "done" && (
                    <>
                        <Check className="size-3.5" />
                        Done
                    </>
                )}
                {state.kind === "upcoming" &&
                    (state.startTime
                        ? `Upcoming · ${hhmm(state.startTime, timezone)}`
                        : "Not scheduled")}
            </span>
        </button>
    );
};

export const GroupChip = ({
    group,
    timezone,
    isSelected,
    onPick,
}: {
    group: PickerGroup;
    timezone?: string;
    isSelected?: boolean;
    onPick: () => void;
}) => (
    <button
        type="button"
        data-picker-chip
        disabled={group.isRunningHere}
        aria-pressed={isSelected}
        aria-label={`Group ${group.number}${group.isRunningHere ? ", running here" : ""}`}
        onClick={onPick}
        className={chipClass(isSelected)}
    >
        <span className="flex w-full items-center justify-between gap-2">
            <span className="font-semibold">Group {group.number}</span>
            {group.isRunningHere && (
                <span className="text-xs font-semibold text-primary">
                    Running
                </span>
            )}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
            {hhmm(group.startTime, timezone)}–{hhmm(group.endTime, timezone)} ·{" "}
            {group.isHere ? "here" : group.roomName}
        </span>
        {group.runningElsewhere.length > 0 && (
            <span className="text-xs text-primary">
                Running in {group.runningElsewhere.join(", ")}
            </span>
        )}
        {group.progress && (
            <span className="flex w-full flex-col gap-1 pt-1">
                <ProgressBar
                    value={group.progress.entered}
                    max={group.progress.expected}
                    label={`Results entered for group ${group.number}`}
                />
                <span className="text-[11px] text-muted-foreground">
                    {group.progress.entered}/{group.progress.expected} attempts
                </span>
            </span>
        )}
        {!group.progress &&
            group.isStarted &&
            !group.isRunningHere &&
            group.runningElsewhere.length === 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Check className="size-3.5" />
                    Started earlier
                </span>
            )}
    </button>
);

export const SuggestedChip = ({
    groupId,
    startTime,
    timezone,
    onPick,
    label = "Suggested",
}: {
    groupId: string;
    startTime?: string;
    timezone?: string;
    onPick: () => void;
    label?: string;
}) => (
    <button
        type="button"
        data-picker-chip
        onClick={onPick}
        className={cn(
            chipClass(),
            "w-fit max-w-full flex-row items-center gap-2 border-primary/60 py-2"
        )}
    >
        <Sparkles className="size-4 shrink-0 text-primary" />
        <span className="truncate">
            <span className="text-muted-foreground">{label}: </span>
            <b className="font-semibold">{shortGroupLabel(groupId)}</b>
            {startTime && (
                <span className="text-muted-foreground">
                    {" "}
                    · {hhmm(startTime, timezone)}
                </span>
            )}
        </span>
    </button>
);

/** "Event › 3x3 R1 › Group", each earlier part going back to its step */
export const PickerBreadcrumb = ({
    step,
    eventShort,
    roundShort,
    isRoundSkipped,
    onGoTo,
}: {
    step: PickerStep;
    /** "3x3" once an event is picked */
    eventShort?: string;
    /** "3x3 R1" once a round is picked */
    roundShort?: string;
    isRoundSkipped: boolean;
    onGoTo: (step: PickerStep) => void;
}) => {
    const parts: { label: string; target?: PickerStep }[] = [
        { label: "Event", target: step === "event" ? undefined : "event" },
    ];
    if (step === "round") parts.push({ label: `${eventShort} · Round` });
    if (step === "group") {
        parts.push({
            label: roundShort ?? "",
            target: isRoundSkipped ? "event" : "round",
        });
        parts.push({ label: "Group" });
    }
    return (
        <nav
            aria-label="Picker steps"
            className="flex min-w-0 flex-wrap items-center gap-1 text-sm"
        >
            {parts.map((part, index) => (
                <span
                    key={part.label + index}
                    className="flex items-center gap-1"
                >
                    {index > 0 && (
                        <ChevronRight
                            aria-hidden
                            className="size-3.5 text-muted-foreground"
                        />
                    )}
                    {part.target ? (
                        <button
                            type="button"
                            onClick={() => onGoTo(part.target!)}
                            className="rounded px-1 text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/40"
                        >
                            {part.label}
                        </button>
                    ) : (
                        <span
                            aria-current="step"
                            className="px-1 font-semibold"
                        >
                            {part.label}
                        </span>
                    )}
                </span>
            ))}
        </nav>
    );
};
