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
    updateCurrentGroup: (room: Room) => void;
}

const RoomsTable = ({
    competition,
    rooms,
    updateCurrentGroup,
}: RoomsTableProps) => {
    return (
        <Table>
            <TableHeader>
                <TableHead>Room</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Round</TableHead>
                <TableHead>Group</TableHead>
            </TableHeader>
            <TableBody>
                {rooms.map((room) => (
                    <RoomRow
                        key={room.id}
                        competition={competition}
                        room={room}
                        updateCurrentGroup={updateCurrentGroup}
                    />
                ))}
            </TableBody>
        </Table>
    );
};

export default RoomsTable;
