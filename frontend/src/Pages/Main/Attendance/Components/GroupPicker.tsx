import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { Competition as WCIF } from "wcif-helpers";

import RoundStrip from "@/Components/shared/RoundStrip";
import SegmentedControl from "@/Components/shared/SegmentedControl";
import { StatusDot } from "@/Components/shared/StatusBadge";
import { Button } from "@/Components/ui/button";
import { getGroupsByRoundId } from "@/lib/activities";
import { Room } from "@/lib/interfaces";
import { getRoundOptions, RoundOption } from "@/lib/roundOptions";
import { shortRoundName } from "@/lib/utils";

interface GroupPickerProps {
    wcif: WCIF;
    rooms: Room[];
    value: string;
    onValueChange: (groupId: string) => void;
}

const groupNumber = (groupId: string) => Number(groupId.split("-g")[1]);

/** Current groups as quick switches, any round via "All rounds", then groups */
const GroupPicker = ({
    wcif,
    rooms,
    value,
    onValueChange,
}: GroupPickerProps) => {
    const roundId = value ? value.split("-g")[0] : "";
    const liveGroupIds = rooms.flatMap((room) => room.currentGroupIds);

    const rounds = useMemo(() => getRoundOptions(wcif, rooms), [wcif, rooms]);

    // Strip entries are groups, not rounds: "3x3 R1" with "Main room · G2"
    const currentGroups: RoundOption[] = rooms.flatMap((room) =>
        room.currentGroupIds.map((groupId) => {
            const round = rounds.find((r) => groupId.startsWith(`${r.id}-g`));
            return {
                id: groupId,
                eventId: groupId.split("-")[0],
                eventName: round?.eventName ?? "",
                label: shortRoundName(groupId.split("-g")[0]),
                name: `${round?.name ?? groupId} · Group ${groupNumber(groupId)}`,
                liveRooms: [`${room.name} · G${groupNumber(groupId)}`],
                isLive: true,
            };
        })
    );

    const groups = useMemo(
        () =>
            roundId
                ? getGroupsByRoundId(roundId, wcif)
                      .map((group) => group.activityCode)
                      .filter((code, i, all) => all.indexOf(code) === i)
                      .sort((a, b) => groupNumber(a) - groupNumber(b))
                : [],
        [roundId, wcif]
    );

    // Every group of every round, for previous/next across round boundaries
    const sequence = useMemo(
        () =>
            rounds.flatMap((round) =>
                getGroupsByRoundId(round.id, wcif)
                    .map((group) => group.activityCode)
                    .sort((a, b) => groupNumber(a) - groupNumber(b))
            ),
        [rounds, wcif]
    );
    const index = sequence.indexOf(value);

    const selectRound = (id: string) => {
        if (id.includes("-g")) return onValueChange(id);
        const live = liveGroupIds.find((groupId) =>
            groupId.startsWith(`${id}-g`)
        );
        const first = getGroupsByRoundId(id, wcif)
            .map((group) => group.activityCode)
            .sort((a, b) => groupNumber(a) - groupNumber(b))[0];
        if (live ?? first) onValueChange(live ?? first);
    };

    return (
        <div className="flex flex-col gap-3">
            <RoundStrip
                rounds={currentGroups}
                allRounds={rounds}
                value={value || undefined}
                allRoundsValue={roundId || undefined}
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
