/**
 * The group picker on wider screens: a dialog with Event | Round | Group
 * side by side, filling in left to right. Every choice stays in view and
 * an earlier column can be changed in place. An event with one round has
 * it chosen at once, so the groups show straight away.
 */
import { Search } from "lucide-react";
import { ReactNode, useEffect, useRef } from "react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/Components/ui/dialog";
import { Input } from "@/Components/ui/input";

import { filterEvents, handlePickerKeys, usePickerSteps } from "./pickerModel";
import { EventChip, GroupChip, RoundChip, SuggestedChip } from "./pickerParts";
import { PickerProps, usePickerContext } from "./usePickerContext";

interface GroupPickerDialogProps extends PickerProps {
    /** The group picked so far, highlighted in its column */
    pickedGroupId?: string;
    /** The Switch to … / Run both step, shown under the columns */
    decision?: ReactNode;
    /** An earlier column changed, so the group picked no longer stands */
    onClearPick?: () => void;
}

const Column = ({
    title,
    children,
    empty,
}: {
    title: string;
    children?: ReactNode;
    empty: string;
}) => (
    <section
        aria-label={title}
        data-picker-column
        className="flex min-h-0 min-w-0 flex-col gap-2 border-l pl-4 first:border-l-0 first:pl-0"
    >
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
        </h3>
        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1 pb-1">
            {children ?? (
                <p className="rounded-lg border border-dashed px-3 py-6 text-center text-[13px] text-muted-foreground">
                    {empty}
                </p>
            )}
        </div>
    </section>
);

const OtherRooms = () => (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        Other rooms
        <span className="h-px flex-1 bg-border" />
    </div>
);

const GroupPickerDialog = (props: GroupPickerDialogProps) => {
    const { room, onCancel, decision, pickedGroupId, onClearPick } = props;
    const { events, timezone, suggestion, stepOptions } =
        usePickerContext(props);
    const steps = usePickerSteps(stepOptions);
    const searchRef = useRef<HTMLInputElement>(null);
    const columnsRef = useRef<HTMLDivElement>(null);
    const here = filterEvents(events.here, steps.search);
    const elsewhere = filterEvents(events.elsewhere, steps.search);

    // A new choice moves focus to the next column's first chip
    useEffect(() => {
        if (!steps.eventId) return;
        const column = steps.roundId ? "Group" : "Round";
        columnsRef.current
            ?.querySelector<HTMLElement>(
                `[aria-label="${column}"] button[data-picker-chip]:not(:disabled)`
            )
            ?.focus();
    }, [steps.eventId, steps.roundId]);

    const eventChip = (event: (typeof here)[number]) => (
        <EventChip
            key={event.id}
            event={event}
            compact
            isSelected={steps.eventId === event.id}
            onPick={() => {
                onClearPick?.();
                steps.pickEvent(event.id);
            }}
        />
    );

    return (
        <Dialog open onOpenChange={(open) => !open && onCancel()}>
            <DialogContent
                className="flex max-h-[min(760px,calc(100dvh-2rem))] w-[min(1040px,calc(100vw-2rem))] max-w-none flex-col gap-4 overflow-hidden"
                onOpenAutoFocus={(e) => {
                    e.preventDefault();
                    searchRef.current?.focus();
                }}
            >
                <DialogHeader>
                    <DialogTitle>Change group in {room.name}</DialogTitle>
                    <DialogDescription>
                        Pick an event, then its round and group.
                    </DialogDescription>
                </DialogHeader>
                {suggestion && (
                    <SuggestedChip
                        groupId={suggestion.groupId}
                        startTime={suggestion.startTime}
                        timezone={timezone}
                        label="Next in this room"
                        onPick={() => steps.pickGroup(suggestion.groupId)}
                    />
                )}
                <div
                    ref={columnsRef}
                    onKeyDown={(e) => handlePickerKeys(e, { columns: true })}
                    className="grid min-h-0 flex-1 grid-cols-[1.15fr_0.9fr_1.25fr] grid-rows-[minmax(0,1fr)] gap-4"
                >
                    <Column title="Event" empty="No event matches">
                        <div className="relative shrink-0">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                ref={searchRef}
                                value={steps.search}
                                onChange={(e) =>
                                    steps.setSearch(e.target.value)
                                }
                                placeholder="Type an event"
                                aria-label="Type an event"
                                className="pl-9"
                                onKeyDown={(e) => {
                                    const [first] = [...here, ...elsewhere];
                                    if (e.key === "Enter" && first) {
                                        e.preventDefault();
                                        steps.pickEvent(first.id);
                                    }
                                }}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                            {here.map(eventChip)}
                        </div>
                        {elsewhere.length > 0 && (
                            <>
                                <OtherRooms />
                                <div className="grid grid-cols-2 gap-1.5">
                                    {elsewhere.map(eventChip)}
                                </div>
                            </>
                        )}
                    </Column>
                    <Column title="Round" empty="Pick an event first">
                        {steps.eventId &&
                            steps.rounds.map((round) => (
                                <RoundChip
                                    key={round.roundId}
                                    round={round}
                                    timezone={timezone}
                                    isSelected={steps.roundId === round.roundId}
                                    onPick={() =>
                                        steps.pickRound(round.roundId)
                                    }
                                />
                            ))}
                    </Column>
                    <Column title="Group" empty="Pick a round first">
                        {steps.roundId && (
                            <div className="grid grid-cols-2 gap-1.5">
                                {steps.groups.map((group) => (
                                    <GroupChip
                                        key={group.groupId}
                                        group={group}
                                        timezone={timezone}
                                        isSelected={
                                            pickedGroupId === group.groupId
                                        }
                                        onPick={() =>
                                            steps.pickGroup(group.groupId)
                                        }
                                    />
                                ))}
                            </div>
                        )}
                    </Column>
                </div>
                {decision && (
                    <div className="shrink-0 border-t pt-4">{decision}</div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default GroupPickerDialog;
