import { XIcon } from "lucide-react";

import { Button } from "@/Components/ui/button";
import { activityCodeToName } from "@/lib/activities";
import { Room } from "@/lib/interfaces";

interface GroupBadgeProps {
    groupId: string;
    room: Room;
    updateCurrentGroups: (roomId: string, groups: string[]) => void;
}

const GroupBadge = ({
    groupId,
    room,
    updateCurrentGroups,
}: GroupBadgeProps) => {
    return (
        <div
            className="px-3 py-1 rounded-full text-sm flex items-center gap-2 bg-primary text-secondary dark:text-secondary-foreground"
            key={groupId}
        >
            <span>{activityCodeToName(groupId, true, true, true)}</span>
            <Button
                variant="ghost"
                size="icon"
                className="w-5 h-5 p-0"
                onClick={() =>
                    updateCurrentGroups(
                        room.id,
                        room.currentGroupIds.filter((id) => id !== groupId)
                    )
                }
            >
                <XIcon className="w-4 h-4" />
            </Button>
        </div>
    );
};

export default GroupBadge;
