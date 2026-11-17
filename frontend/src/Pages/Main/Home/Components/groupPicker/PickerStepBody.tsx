/** The current step's chips, one step at a time (the inline picker) */
import { Search } from "lucide-react";
import { useEffect, useRef } from "react";

import { Input } from "@/Components/ui/input";

import { filterEvents, PickerEvent, PickerSteps } from "./pickerModel";
import { EventChip, GroupChip, RoundChip, SuggestedChip } from "./pickerParts";

export interface Suggestion {
    groupId: string;
    startTime?: string;
}

interface PickerStepBodyProps {
    steps: PickerSteps;
    events: { here: PickerEvent[]; elsewhere: PickerEvent[] };
    timezone?: string;
    suggestion?: Suggestion;
}

const PickerStepBody = ({
    steps,
    events,
    timezone,
    suggestion,
}: PickerStepBodyProps) => {
    const ref = useRef<HTMLDivElement>(null);

    // Each step starts with focus on its first chip (or the search box)
    useEffect(() => {
        const first = ref.current?.querySelector<HTMLElement>(
            steps.step === "event"
                ? "input"
                : "button[data-picker-chip]:not(:disabled)"
        );
        first?.focus();
    }, [steps.step]);

    const grid = "grid grid-cols-2 gap-1.5 sm:grid-cols-3";

    if (steps.step === "event") {
        const here = filterEvents(events.here, steps.search);
        const elsewhere = filterEvents(events.elsewhere, steps.search);
        return (
            <div ref={ref} data-picker-grid className="flex flex-col gap-3">
                {suggestion && !steps.search && (
                    <SuggestedChip
                        groupId={suggestion.groupId}
                        startTime={suggestion.startTime}
                        timezone={timezone}
                        onPick={() => steps.pickGroup(suggestion.groupId)}
                    />
                )}
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={steps.search}
                        onChange={(e) => steps.setSearch(e.target.value)}
                        placeholder="Type an event"
                        aria-label="Type an event"
                        className="pl-9"
                        onKeyDown={(e) => {
                            const [only] = [...here, ...elsewhere];
                            if (e.key === "Enter" && only) {
                                e.preventDefault();
                                steps.pickEvent(only.id);
                            }
                        }}
                    />
                </div>
                <div className={grid}>
                    {here.map((event) => (
                        <EventChip
                            key={event.id}
                            event={event}
                            onPick={() => steps.pickEvent(event.id)}
                        />
                    ))}
                </div>
                {elsewhere.length > 0 && (
                    <>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="h-px flex-1 bg-border" />
                            Other rooms
                            <span className="h-px flex-1 bg-border" />
                        </div>
                        <div className={grid}>
                            {elsewhere.map((event) => (
                                <EventChip
                                    key={event.id}
                                    event={event}
                                    onPick={() => steps.pickEvent(event.id)}
                                />
                            ))}
                        </div>
                    </>
                )}
                {here.length + elsewhere.length === 0 && (
                    <p className="py-4 text-center text-[13px] text-muted-foreground">
                        No event matches “{steps.search}”
                    </p>
                )}
            </div>
        );
    }

    if (steps.step === "round")
        return (
            <div ref={ref} data-picker-grid className={grid}>
                {steps.rounds.map((round) => (
                    <RoundChip
                        key={round.roundId}
                        round={round}
                        timezone={timezone}
                        onPick={() => steps.pickRound(round.roundId)}
                    />
                ))}
            </div>
        );

    return (
        <div ref={ref} data-picker-grid className={grid}>
            {steps.groups.map((group) => (
                <GroupChip
                    key={group.groupId}
                    group={group}
                    timezone={timezone}
                    onPick={() => steps.pickGroup(group.groupId)}
                />
            ))}
            {steps.groups.length === 0 && (
                <p className="col-span-full py-4 text-center text-[13px] text-muted-foreground">
                    This round has no groups in the schedule
                </p>
            )}
        </div>
    );
};

export default PickerStepBody;
