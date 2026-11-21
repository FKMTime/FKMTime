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
    /** Groups the user takes attendance for; every group when left out */
    hasGroup?: (groupId: string) => boolean;
}

const groupNumber = (groupId: string) => Number(groupId.split("-g")[1]);

const everyGroup = () => true;

const sortedGroupIds = (
    roundId: string,
    wcif: WCIF,
    hasGroup: (groupId: string) => boolean
) =>
    getGroupsByRoundId(roundId, wcif)
        .map((group) => group.activityCode)
        .filter((code, i, all) => all.indexOf(code) === i && hasGroup(code))
        .sort((a, b) => groupNumber(a) - groupNumber(b));

/** Event, then round, then group; previous/next steps across rounds */
const GroupPicker = ({
    wcif,
    rooms,
    value,
    onValueChange,
    hasGroup = everyGroup,
}: GroupPickerProps) => {
    const roundId = value ? value.split("-g")[0] : "";
    const liveGroupIds = rooms.flatMap((room) => room.currentGroupIds);
    const liveRoundIds = useMemo(() => getLiveRoundIds(rooms), [rooms]);

    // A stage lead picks among their rooms' rounds only (SPEC-016)
    const pickableWcif = useMemo(
        () =>
            hasGroup === everyGroup
                ? wcif
                : {
                      ...wcif,
                      events: wcif.events
                          .map((event) => ({
                              ...event,
                              rounds: event.rounds.filter(
                                  (round) =>
                                      sortedGroupIds(round.id, wcif, hasGroup)
                                          .length > 0
                              ),
                          }))
                          .filter((event) => event.rounds.length > 0),
                  },
        [wcif, hasGroup]
    );

    const groups = useMemo(
        () => (roundId ? sortedGroupIds(roundId, wcif, hasGroup) : []),
        [roundId, wcif, hasGroup]
    );

    // Every group in schedule order, for previous/next across rounds
    const sequence = useMemo(
        () =>
            getRoundsInScheduleOrder(wcif).flatMap((id) =>
                sortedGroupIds(id, wcif, hasGroup)
            ),
        [wcif, hasGroup]
    );
    const index = sequence.indexOf(value);

    // A new round opens on its group in progress, or its first group
    const selectRound = (id: string) => {
        const live = liveGroupIds.find(
            (groupId) => groupId.startsWith(`${id}-g`) && hasGroup(groupId)
        );
        const target = live ?? sortedGroupIds(id, wcif, hasGroup)[0];
        if (target) onValueChange(target);
    };

    return (
        <div className="flex flex-col gap-3">
            <RoundPicker
                wcif={pickableWcif}
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
