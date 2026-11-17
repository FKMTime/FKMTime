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
    /** Every result of the room's groups is in, or it runs none */
    isReady: (room: Room) => boolean;
    /** Saves the rooms that change; an error message, or null once saved */
    onSwitch: (rooms: Room[]) => Promise<string | null>;
}

const groupNames = (groupIds: string[]) =>
    groupIds.map((id) => activityCodeToName(id, false, true, true)).join(", ");

const listNames = (names: string[]) =>
    names.length < 2
        ? names.join("")
        : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

/**
 * Shows up once two or more rooms are ready for their next group, and
 * moves them all in one go after a confirmation listing each change.
 * Rooms still running, or with nothing next, are left alone.
 */
const NextGroupInAllRooms = ({
    rooms,
    nextGroups,
    isReady,
    onSwitch,
}: NextGroupInAllRoomsProps) => {
    // The rooms the open dialog moves, fixed when it opened, so a room that
    // finishes meanwhile doesn't change what is being confirmed
    const [confirming, setConfirming] = useState<Room[] | null>(null);
    const [isSwitching, setIsSwitching] = useState(false);
    const [error, setError] = useState("");

    const ready = rooms.filter(
        (room) => (nextGroups[room.id] ?? []).length > 0 && isReady(room)
    );
    if (ready.length < 2 && !confirming) return null;

    const labelFor = (count: number) =>
        count === rooms.length
            ? "Next group in all rooms"
            : `Next group in ${count} rooms`;

    const close = () => {
        setConfirming(null);
        setError("");
    };

    const handleConfirm = async () => {
        setIsSwitching(true);
        // Only these rooms, so another isn't saved with groups that may have
        // changed since Home loaded them
        const message = await onSwitch(
            (confirming ?? []).map((room) => ({
                ...room,
                currentGroupIds: nextGroups[room.id],
            }))
        );
        setIsSwitching(false);
        if (message === null) close();
        else setError(message);
    };

    return (
        <>
            {ready.length >= 2 && (
                <section
                    aria-label="Rooms ready for their next group"
                    className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-3 sm:flex-row sm:items-center"
                >
                    <p className="min-w-0 flex-1 text-sm">
                        <b className="font-semibold">
                            {listNames(ready.map((room) => room.name))}
                        </b>{" "}
                        <span className="text-muted-foreground">
                            are ready for their next group.
                        </span>
                    </p>
                    <Button onClick={() => setConfirming(ready)}>
                        <SkipForward />
                        {labelFor(ready.length)}
                    </Button>
                </section>
            )}
            <Modal
                isOpen={!!confirming}
                onClose={close}
                title={labelFor(confirming?.length ?? 0)}
                error={error}
            >
                <p className="text-sm text-muted-foreground">
                    Stations in each room switch to the group shown.
                </p>
                <ul className="flex flex-col divide-y rounded-xl border">
                    {(confirming ?? []).map((room) => (
                        <li
                            key={room.id}
                            className="flex flex-col gap-0.5 px-3.5 py-2.5"
                        >
                            <span className="text-sm font-semibold">
                                {room.name}
                            </span>
                            <span className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
                                {groupNames(room.currentGroupIds) || "No group"}
                                <ArrowRight
                                    aria-label="to"
                                    className="size-3.5 shrink-0"
                                />
                                <span className="font-medium text-foreground">
                                    {groupNames(nextGroups[room.id])}
                                </span>
                            </span>
                        </li>
                    ))}
                </ul>
                <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                    <Button variant="outline" onClick={close}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm} disabled={isSwitching}>
                        Start next groups
                    </Button>
                </div>
            </Modal>
        </>
    );
};

export default NextGroupInAllRooms;
