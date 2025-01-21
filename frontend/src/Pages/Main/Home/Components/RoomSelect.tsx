import { Room } from "@wca/helpers";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";

interface RoomSelectProps {
    rooms: Room[];
    selectedRoomId: string;
    onChange: (id: string) => void;
}

const RoomSelect = ({ rooms, selectedRoomId, onChange }: RoomSelectProps) => {
    return (
        <Select
            value={selectedRoomId}
            onValueChange={(value) => onChange(value)}
        >
            <SelectTrigger className="w-fit">
                <SelectValue placeholder="Select a room" />
            </SelectTrigger>
            <SelectContent>
                {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.id.toString()}>
                        {room.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};

export default RoomSelect;
