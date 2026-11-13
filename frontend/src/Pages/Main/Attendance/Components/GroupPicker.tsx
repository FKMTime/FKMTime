import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { Competition as WCIF } from "wcif-helpers";

import RoundPicker from "@/Components/shared/RoundPicker";
import SegmentedControl from "@/Components/shared/SegmentedControl";
import { StatusDot } from "@/Components/shared/StatusBadge";
import { Button } from "@/Components/ui/button";
import { getGroupsByRoundId } from "@/lib/activities";
import { Room } from "@/lib/interfaces";
import { getLiveRoundIds, getRoundsInScheduleOrder } from "@/lib/roundOptions";

interface GroupPickerProps {
    wcif: WCIF;
    rooms: Room[];
    value: string;
    onValueChange: (groupId: string) => void;
}

const groupNumber = (groupId: string) => Number(groupId.split("-g")[1]);

const sortedGroupIds = (roundId: string, wcif: WCIF) =>
    getGroupsByRoundId(roundId, wcif)
        .map((group) => group.activityCode)
        .filter((code, i, all) => all.indexOf(code) === i)
        .sort((a, b) => groupNumber(a) - groupNumber(b));

/** Event, then round, then group; previous/next steps across rounds */
const GroupPicker = ({
    wcif,
    rooms,
    value,
    onValueChange,
}: GroupPickerProps) => {
    const roundId = value ? value.split("-g")[0] : "";
    const liveGroupIds = rooms.flatMap((room) => room.currentGroupIds);
    const liveRoundIds = useMemo(() => getLiveRoundIds(rooms), [rooms]);

    const groups = useMemo(
        () => (roundId ? sortedGroupIds(roundId, wcif) : []),
        [roundId, wcif]
    );

    // Every group in schedule order, for previous/next across rounds
    const sequence = useMemo(
        () =>
            getRoundsInScheduleOrder(wcif).flatMap((id) =>
                sortedGroupIds(id, wcif)
            ),
        [wcif]
    );
    const index = sequence.indexOf(value);

    // A new round opens on its group in progress, or its first group
    const selectRound = (id: string) => {
        const live = liveGroupIds.find((groupId) =>
            groupId.startsWith(`${id}-g`)
        );
        const target = live ?? sortedGroupIds(id, wcif)[0];
        if (target) onValueChange(target);
    };

    return (
        <div className="flex flex-col gap-3">
            <RoundPicker
                wcif={wcif}
                timeline
                liveRoundIds={liveRoundIds}
                value={roundId}
                onValueChange={selectRound}
            />
            {groups.length > 0 && (
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="Previous group"
                        disabled={index <= 0}
                        onClick={() => onValueChange(sequence[index - 1])}
                    >
                        <ChevronLeft />
                    </Button>
                    <SegmentedControl
                        label="Group"
                        value={value}
                        onValueChange={onValueChange}
                        className="min-w-0 flex-1 md:flex-none"
                        options={groups.map((groupId) => ({
                            value: groupId,
                            ariaLabel: `Group ${groupNumber(groupId)}${liveGroupIds.includes(groupId) ? ", in progress" : ""}`,
                            label: (
                                <>
                                    {liveGroupIds.includes(groupId) && (
                                        <StatusDot tone="primary" />
                                    )}
                                    Group {groupNumber(groupId)}
                                </>
                            ),
                        }))}
                    />
                    <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="Next group"
                        disabled={index === -1 || index >= sequence.length - 1}
                        onClick={() => onValueChange(sequence[index + 1])}
                    >
                        <ChevronRight />
                    </Button>
                </div>
            )}
        </div>
    );
};

export default GroupPicker;
