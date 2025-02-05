import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
} from "@/Components/ui/table";
import { Competition, Room } from "@/lib/interfaces";

import RoomRow from "./RoomRow";

interface RoomsTableProps {
    competition: Competition;
    rooms: Room[];
    updateCurrentGroups: (roomId: string, groups: string[]) => void;
}

const RoomsTable = ({
    competition,
    rooms,
    updateCurrentGroups,
}: RoomsTableProps) => {
    return (
        <Table>
            <TableHeader>
                <TableHead>Room</TableHead>
                <TableHead>Groups</TableHead>
                <TableHead>Actions</TableHead>
            </TableHeader>
            <TableBody>
                {rooms.map((room) => (
                    <RoomRow
                        key={room.id}
                        competition={competition}
                        room={room}
                        updateCurrentGroups={updateCurrentGroups}
                    />
                ))}
            </TableBody>
        </Table>
    );
};

export default RoomsTable;
