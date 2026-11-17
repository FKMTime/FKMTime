import { useState } from "react";
import { Competition as WCIF } from "wcif-helpers";

import { Button } from "@/Components/ui/button";
import { canAddGroup, roundLabel, shortGroupLabel } from "@/lib/currentGroups";
import { Room } from "@/lib/interfaces";
import { GroupProgress } from "@/lib/rooms";

import GroupPicker from "./groupPicker/GroupPicker";
import { useAskToChangeGroups } from "./useAskToChangeGroups";

interface ChangeGroupProps {
    room: Room;
    /** Every room, so the picker can say where other groups run */
    rooms: Room[];
    wcif: WCIF;
    nextGroupIds: string[];
    getProgress: (roomId: string, groupId: string) => GroupProgress | undefined;
    onSetGroups: (room: Room, groupIds: string[]) => Promise<boolean>;
    onClose: () => void;
}

/**
 * Picks any group for a room (event → round → group), then switches to it
 * or runs it next to the room's current group
 */
const ChangeGroup = ({
    room,
    rooms,
    wcif,
    nextGroupIds,
    getProgress,
    onSetGroups,
    onClose,
}: ChangeGroupProps) => {
    const ask = useAskToChangeGroups();
    const [picked, setPicked] = useState<string>();
    const groups = room.currentGroupIds;

    const apply = async (groupIds: string[]) => {
        if (await onSetGroups(room, groupIds)) onClose();
    };

    // An empty room has nothing to run next to: start the group straight away
    const handlePick = async (groupId: string) => {
        if (groups.length > 0) {
            setPicked(groupId);
            return;
        }
        const label = `Start ${shortGroupLabel(groupId)}`;
        if (await ask(`${label} in ${room.name}?`, label)) apply([groupId]);
    };

    const canRunAll = picked ? canAddGroup(groups, picked) : false;
    const runAllLabel =
        groups.length === 1 ? "Run both" : `Run all ${groups.length + 1}`;

    const decision = picked ? (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <p className="text-sm font-semibold">
                {roundLabel(picked)} · Group {picked.split("-g")[1]}
            </p>
            <div className="flex flex-wrap gap-2">
                <Button onClick={() => apply([picked])}>
                    Switch to {shortGroupLabel(picked)}
                </Button>
                <Button
                    variant="outline"
                    disabled={!canRunAll}
                    onClick={() => apply([...groups, picked])}
                >
                    {runAllLabel}
                </Button>
                <Button variant="ghost" onClick={onClose}>
                    Cancel
                </Button>
            </div>
            <p className="text-[13px] text-muted-foreground">
                {canRunAll
                    ? `Stations in this room will accept results for ${groups.length === 1 ? "both groups" : "all of them"}.`
                    : "A room runs one group of an event at a time, so this one can only replace it."}
            </p>
        </div>
    ) : undefined;

    return (
        <GroupPicker
            wcif={wcif}
            room={room}
            rooms={rooms}
            getProgress={getProgress}
            nextGroupIds={nextGroupIds}
            pickedGroupId={picked}
            onClearPick={() => setPicked(undefined)}
            onPick={handlePick}
            onCancel={onClose}
            decision={decision}
        />
    );
};

export default ChangeGroup;
