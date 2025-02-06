import { Room } from "@/lib/interfaces";

import GroupBadge from "./GroupBadge";

interface CurrentGroupsListProps {
    room: Room;
    updateCurrentGroups: (roomId: string, groups: string[]) => void;
}
const CurrentGroupsList = ({
    room,
    updateCurrentGroups,
}: CurrentGroupsListProps) => {
    return (
        <div className="flex md:flex-row flex-col gap-2">
            {room.currentGroupIds.map((groupId) => (
                <GroupBadge
                    groupId={groupId}
                    room={room}
                    updateCurrentGroups={updateCurrentGroups}
                />
            ))}
        </div>
    );
};

export default CurrentGroupsList;
