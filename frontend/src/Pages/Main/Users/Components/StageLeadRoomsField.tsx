import { Checkbox } from "@/Components/ui/checkbox";
import { Label } from "@/Components/ui/label";
import { Room } from "@/lib/interfaces";
import { showsRoomChoice, StageLeadRoomsValue } from "@/lib/stageLeadRooms";

interface StageLeadRoomsFieldProps {
    roles: string[];
    /** In schedule order */
    rooms: Pick<Room, "id" | "name">[];
    value: StageLeadRoomsValue;
    onChange: (value: StageLeadRoomsValue) => void;
}

const rowClass =
    "flex min-h-11 cursor-pointer items-center gap-3 font-normal md:min-h-8";

/**
 * Which rooms a stage lead takes attendance in (SPEC-016). Shown only for a
 * stage lead who isn't also an organizer, delegate or admin, and only when
 * there is more than one room to choose from.
 */
const StageLeadRoomsField = ({
    roles,
    rooms,
    value,
    onChange,
}: StageLeadRoomsFieldProps) => {
    if (!showsRoomChoice(roles, rooms.length)) return null;

    const toggleRoom = (roomId: string, checked: boolean) => {
        const roomIds = checked
            ? [...value.roomIds, roomId]
            : value.roomIds.filter((id) => id !== roomId);
        // Every room ticked by hand is all rooms
        const allRooms = rooms.every((room) => roomIds.includes(room.id));
        onChange({ allRooms, roomIds: allRooms ? [] : roomIds });
    };
    const isMissing = !value.allRooms && value.roomIds.length === 0;

    return (
        <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-medium">
                Takes attendance in
            </legend>
            <Label className={rowClass}>
                <Checkbox
                    checked={value.allRooms}
                    onCheckedChange={(checked) =>
                        onChange({ allRooms: !!checked, roomIds: [] })
                    }
                />
                All rooms
            </Label>
            {rooms.map((room) => (
                <Label key={room.id} className={`${rowClass} pl-7`}>
                    <Checkbox
                        checked={
                            value.allRooms || value.roomIds.includes(room.id)
                        }
                        disabled={value.allRooms}
                        onCheckedChange={(checked) =>
                            toggleRoom(room.id, !!checked)
                        }
                    />
                    {room.name}
                </Label>
            ))}
            {isMissing && (
                <p className="text-sm text-muted-foreground">
                    Choose at least one room
                </p>
            )}
        </fieldset>
    );
};

export default StageLeadRoomsField;
