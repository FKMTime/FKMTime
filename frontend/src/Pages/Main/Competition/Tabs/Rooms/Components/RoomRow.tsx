import { useState } from "react";

import { Button } from "@/Components/ui/button";
import { TableCell, TableRow } from "@/Components/ui/table";
import { Competition, Room } from "@/lib/interfaces";

import AddGroupModal from "./AddGroupModal";
import CurrentGroupsList from "./CurrentGroupsList";

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
                <CurrentGroupsList
                    room={room}
                    updateCurrentGroups={updateCurrentGroups}
                />
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
