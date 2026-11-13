import { ChevronLeft, Plus } from "lucide-react";
import { useState } from "react";
import { Event } from "wcif-helpers";

import RoundGrid from "@/Components/shared/RoundGrid";
import { Button } from "@/Components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/Components/ui/popover";
import { canAddGroup, GroupOption } from "@/lib/currentGroups";
import { getEventIconClass } from "@/lib/events";
import { roundName } from "@/lib/roundOptions";
import { cn } from "@/lib/utils";

interface AddGroupPickerProps {
    events: Event[];
    groupOptions: GroupOption[];
    /** Groups already running in the room */
    currentGroupIds: string[];
    /** Round the grid highlights, e.g. the room's next one by schedule */
    suggestedRoundId?: string;
    onAdd: (groupId: string) => void;
}

const groupNumber = (groupId: string) => Number(groupId.split("-g")[1]);

/** Pick the round from the event grid, then one of its groups */
const AddGroupPicker = ({
    events,
    groupOptions,
    currentGroupIds,
    suggestedRoundId = "",
    onAdd,
}: AddGroupPickerProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [roundId, setRoundId] = useState("");

    const roundsInRoom = currentGroupIds.map((id) => id.split("-g")[0]);
    const groupIds = [
        ...new Set(
            groupOptions
                .map((option) => option.id)
                .filter((id) => id.startsWith(`${roundId}-g`))
        ),
    ].sort((a, b) => groupNumber(a) - groupNumber(b));

    const add = (groupId: string) => {
        setIsOpen(false);
        onAdd(groupId);
    };

    return (
        <Popover
            open={isOpen}
            onOpenChange={(open) => {
                setIsOpen(open);
                if (!open) setRoundId("");
            }}
        >
            <PopoverTrigger asChild>
                <Button variant="outline" className="w-fit">
                    <Plus />
                    Add group
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                className="flex max-h-[min(520px,var(--radix-popover-content-available-height))] w-[min(440px,calc(100vw-2rem))] flex-col overflow-hidden rounded-mobile-card p-0"
            >
                {roundId ? (
                    <>
                        <div className="flex items-center gap-1 border-b p-1.5">
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Back to rounds"
                                onClick={() => setRoundId("")}
                            >
                                <ChevronLeft />
                            </Button>
                            <span
                                aria-hidden
                                className={cn(
                                    "cubing-icon text-base",
                                    getEventIconClass(roundId.split("-")[0])
                                )}
                            />
                            <span className="text-sm font-semibold">
                                {roundName(roundId)}
                            </span>
                        </div>
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-1.5 overflow-y-auto p-2.5">
                            {groupIds.map((groupId) => {
                                const isAdded =
                                    currentGroupIds.includes(groupId);
                                return (
                                    <Button
                                        key={groupId}
                                        variant="outline"
                                        disabled={
                                            !canAddGroup(
                                                currentGroupIds,
                                                groupId
                                            )
                                        }
                                        className={cn(
                                            isAdded &&
                                                "border-primary bg-primary-soft text-primary"
                                        )}
                                        onClick={() => add(groupId)}
                                    >
                                        Group {groupNumber(groupId)}
                                    </Button>
                                );
                            })}
                        </div>
                        {groupIds.some(
                            (id) =>
                                !currentGroupIds.includes(id) &&
                                !canAddGroup(currentGroupIds, id)
                        ) && (
                            <p className="border-t px-3.5 py-2.5 text-[13px] text-muted-foreground">
                                A room runs one group of an event at a time.
                            </p>
                        )}
                        {groupIds.length === 0 && (
                            <p className="p-6 text-center text-[13px] text-muted-foreground">
                                This round has no groups in the schedule
                            </p>
                        )}
                    </>
                ) : (
                    <RoundGrid
                        events={events}
                        liveRoundIds={roundsInRoom}
                        value={suggestedRoundId}
                        onPick={setRoundId}
                    />
                )}
            </PopoverContent>
        </Popover>
    );
};

export default AddGroupPicker;
