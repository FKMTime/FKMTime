import {
    ArrowLeftRight,
    MoreHorizontal,
    SkipBack,
    Square,
    X,
} from "lucide-react";

import { Button } from "@/Components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { getPreviousGroupsFromScheduleForRoom } from "@/lib/competition";
import { shortGroupLabel } from "@/lib/currentGroups";
import { Room } from "@/lib/interfaces";

import { useAskToChangeGroups } from "./useAskToChangeGroups";

interface RoomGroupMenuProps {
    room: Room;
    onChangeGroup: () => void;
    onSetGroups: (room: Room, groupIds: string[]) => Promise<boolean>;
}

/**
 * The group changes a room needs now and then, behind its "…" button:
 * starting the next group is on the card itself
 */
const RoomGroupMenu = ({
    room,
    onChangeGroup,
    onSetGroups,
}: RoomGroupMenuProps) => {
    const ask = useAskToChangeGroups();
    const groups = room.currentGroupIds;

    const handleBack = async () => {
        const previous: string[] = await getPreviousGroupsFromScheduleForRoom(
            room.id,
            groups
        );
        if (previous.length === 0) return;
        const label = `Start ${previous.map(shortGroupLabel).join(" + ")}`;
        const title = `${label} in ${room.name}?`;
        if (await ask({ title, confirmLabel: label, change: "start" }))
            await onSetGroups(room, previous);
    };

    const stopGroup = async (groupId: string) => {
        const label = `Stop ${shortGroupLabel(groupId)}`;
        const title = `${label} in ${room.name}?`;
        if (await ask({ title, confirmLabel: label, change: "stopGroup" }))
            await onSetGroups(
                room,
                groups.filter((id) => id !== groupId)
            );
    };

    const stopRoom = async () => {
        const confirmed = await ask({
            title: `Stop every group in ${room.name}?`,
            confirmLabel: "Stop the room",
            change: "stopRoom",
        });
        if (confirmed) await onSetGroups(room, []);
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`More for ${room.name}`}
                    className="-my-1 -mr-1.5 ml-auto"
                >
                    <MoreHorizontal />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onChangeGroup}>
                    <ArrowLeftRight />
                    Change group…
                </DropdownMenuItem>
                <DropdownMenuItem
                    disabled={groups.length === 0}
                    onSelect={handleBack}
                >
                    <SkipBack />
                    Back to the previous group
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {groups.length > 1 &&
                    groups.map((groupId) => (
                        <DropdownMenuItem
                            key={groupId}
                            className="text-destructive"
                            onSelect={() => stopGroup(groupId)}
                        >
                            <X />
                            Stop {shortGroupLabel(groupId)}
                        </DropdownMenuItem>
                    ))}
                <DropdownMenuItem
                    disabled={groups.length === 0}
                    className="text-destructive"
                    onSelect={stopRoom}
                >
                    <Square />
                    Stop the room
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default RoomGroupMenu;
