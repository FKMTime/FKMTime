import { ArrowRight, SkipForward } from "lucide-react";
import { useState } from "react";

import { Modal } from "@/Components/Modal";
import { Button } from "@/Components/ui/button";
import { activityCodeToName } from "@/lib/activities";
import { Room } from "@/lib/interfaces";

interface NextGroupInAllRoomsProps {
    rooms: Room[];
    /** Next groups from the schedule, by room id */
    nextGroups: Record<string, string[]>;
    /** Resolves to an error message, or null once every room has switched */
    onSwitch: (rooms: Room[]) => Promise<string | null>;
}

const groupNames = (groupIds: string[]) =>
    groupIds.map((id) => activityCodeToName(id, false, true, true)).join(", ");

/**
 * Moves every room to its next group from the schedule in one go, after a
 * confirmation listing each room's change. Rooms with nothing next keep
 * their current group.
 */
const NextGroupInAllRooms = ({
    rooms,
    nextGroups,
    onSwitch,
}: NextGroupInAllRoomsProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isSwitching, setIsSwitching] = useState(false);
    const [error, setError] = useState("");

    const hasNext = (room: Room) => (nextGroups[room.id] ?? []).length > 0;
    if (rooms.length < 2 || !rooms.some(hasNext)) return null;

    const close = () => {
        setIsOpen(false);
        setError("");
    };

    const handleConfirm = async () => {
        setIsSwitching(true);
        const message = await onSwitch(
            rooms.map((room) =>
                hasNext(room)
                    ? { ...room, currentGroupIds: nextGroups[room.id] }
                    : room
            )
        );
        setIsSwitching(false);
        if (message === null) close();
        else setError(message);
    };

    return (
        <>
            <Button
                variant="outline"
                onClick={() => setIsOpen(true)}
                className="self-end max-md:w-full"
            >
                <SkipForward />
                Next group in all rooms
            </Button>
            <Modal
                isOpen={isOpen}
                onClose={close}
                title="Next group in all rooms"
                error={error}
            >
                <p className="text-sm text-muted-foreground">
                    Devices in each room switch to the group shown.
                </p>
                <ul className="flex flex-col divide-y rounded-xl border">
                    {rooms.map((room) => (
                        <li
                            key={room.id}
                            className="flex flex-col gap-0.5 px-3.5 py-2.5"
                        >
                            <span className="text-sm font-semibold">
                                {room.name}
                            </span>
                            <span className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
                                {groupNames(room.currentGroupIds) || "No group"}
                                {hasNext(room) ? (
                                    <>
                                        <ArrowRight
                                            aria-label="to"
                                            className="size-3.5 shrink-0"
                                        />
                                        <span className="font-medium text-foreground">
                                            {groupNames(nextGroups[room.id])}
                                        </span>
                                    </>
                                ) : (
                                    " · nothing next, stays as is"
                                )}
                            </span>
                        </li>
                    ))}
                </ul>
                <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                    <Button variant="outline" onClick={close}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm} disabled={isSwitching}>
                        Switch all rooms
                    </Button>
                </div>
            </Modal>
        </>
    );
};

export default NextGroupInAllRooms;
