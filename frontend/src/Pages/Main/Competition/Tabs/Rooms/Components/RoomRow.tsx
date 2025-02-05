import { XIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/Components/ui/button";
import { TableCell, TableRow } from "@/Components/ui/table";
import { activityCodeToName } from "@/lib/activities";
import { Competition, Room } from "@/lib/interfaces";

import AddGroupModal from "./AddGroupModal";

interface RoomRowProps {
    competition: Competition;
    room: Room;
    updateCurrentGroups: (roomId: string, groups: string[]) => void;
}

const RoomRow = ({ competition, room, updateCurrentGroups }: RoomRowProps) => {
    const [isOpenAddGroupModal, setIsOpenAddGroupModal] = useState(false);
    return (
        <TableRow>
            <TableCell>{room.name}</TableCell>
            <TableCell>
                <div className="flex gap-2">
                    {room.currentGroupIds.map((groupId) => (
                        <div
                            className="px-3 py-1 rounded-full text-sm flex items-center gap-2 bg-primary text-secondary dark:text-secondary-foreground"
                            key={groupId}
                        >
                            <span>{activityCodeToName(groupId)}</span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="w-5 h-5 p-0"
                                onClick={() =>
                                    updateCurrentGroups(
                                        room.id,
                                        room.currentGroupIds.filter(
                                            (id) => id !== groupId
                                        )
                                    )
                                }
                            >
                                <XIcon className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            </TableCell>
            <TableCell className="flex gap-2">
                <Button
                    variant="success"
                    onClick={() => setIsOpenAddGroupModal(true)}
                >
                    Add
                </Button>
                <Button
                    variant="destructive"
                    onClick={() => updateCurrentGroups(room.id, [])}
                >
                    Clear
                </Button>
            </TableCell>
            <AddGroupModal
                isOpen={isOpenAddGroupModal}
                onClose={() => setIsOpenAddGroupModal(false)}
                competition={competition}
                room={room}
                onSubmit={(groupId) => {
                    updateCurrentGroups(room.id, [
                        ...room.currentGroupIds,
                        groupId,
                    ]);
                    setIsOpenAddGroupModal(false);
                }}
            />
        </TableRow>
    );
};

export default RoomRow;
