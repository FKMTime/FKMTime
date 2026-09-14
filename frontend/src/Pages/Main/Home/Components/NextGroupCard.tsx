import { ArrowRight, SkipForward } from "lucide-react";
import { useState } from "react";

import { Modal } from "@/Components/Modal";
import ModalActions from "@/Components/ModalActions";
import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import { getNextGroupsFromScheduleForRoom } from "@/lib/competition";
import { Room } from "@/lib/interfaces";
import { updateCurrentRound } from "@/lib/rooms";

interface RoomPreview {
    room: Room;
    nextGroups: string[];
}

interface NextGroupCardProps {
    rooms: Room[];
    onGroupSwitched: () => void;
}

const NextGroupCard = ({ rooms, onGroupSwitched }: NextGroupCardProps) => {
    const { toast } = useToast();
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isSwitching, setIsSwitching] = useState(false);
    const [previews, setPreviews] = useState<RoomPreview[]>([]);

    const activeRooms = rooms.filter((r) => r.currentGroupIds.length > 0);

    if (activeRooms.length === 0) return null;

    const openModal = async () => {
        const fetched = await Promise.all(
            activeRooms.map(async (room) => ({
                room,
                nextGroups: await getNextGroupsFromScheduleForRoom(room.id),
            }))
        );
        setPreviews(fetched);
        setIsConfirmOpen(true);
    };

    const handleSwitchAll = async () => {
        setIsSwitching(true);
        try {
            const updatedRooms = rooms.map((room) => {
                const preview = previews.find((p) => p.room.id === room.id);
                if (!preview) return room;
                return { ...room, currentGroupIds: preview.nextGroups };
            });
            const result = await updateCurrentRound(updatedRooms);
            if (result.status === 200) {
                toast({
                    title: "Switched all rooms to next from schedule",
                    variant: "success",
                });
                onGroupSwitched();
            } else {
                toast({
                    title: "Failed to switch groups",
                    variant: "destructive",
                });
            }
        } catch {
            toast({ title: "Failed to switch groups", variant: "destructive" });
        } finally {
            setIsSwitching(false);
            setIsConfirmOpen(false);
        }
    };

    return (
        <>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="flex gap-2 items-center text-base">
                        <SkipForward size={18} />
                        Current groups
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        {activeRooms.map((room) => (
                            <div key={room.id}>
                                <span className="font-medium">
                                    {room.name}:
                                </span>{" "}
                                {room.currentGroupIds
                                    .map((gid) =>
                                        activityCodeToName(
                                            gid,
                                            false,
                                            true,
                                            true
                                        )
                                    )
                                    .join(", ")}
                            </div>
                        ))}
                    </div>
                    <Button
                        size="sm"
                        className="self-start"
                        onClick={openModal}
                    >
                        <SkipForward size={14} />
                        Switch all to next from schedule
                    </Button>
                </CardContent>
            </Card>

            <Modal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                title="Switch all rooms to next group"
            >
                <div className="flex flex-col gap-3 text-sm">
                    {previews.map(({ room, nextGroups }) => (
                        <div key={room.id} className="flex flex-col gap-0.5">
                            <span className="font-medium">{room.name}</span>
                            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                                <span>
                                    {room.currentGroupIds
                                        .map((gid) =>
                                            activityCodeToName(
                                                gid,
                                                false,
                                                true,
                                                true
                                            )
                                        )
                                        .join(", ")}
                                </span>
                                <ArrowRight size={12} className="shrink-0" />
                                <span>
                                    {nextGroups.length > 0
                                        ? nextGroups
                                              .map((gid) =>
                                                  activityCodeToName(
                                                      gid,
                                                      false,
                                                      true,
                                                      true
                                                  )
                                              )
                                              .join(", ")
                                        : "no next group"}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
                <ModalActions>
                    <Button
                        variant="success"
                        onClick={handleSwitchAll}
                        disabled={isSwitching}
                    >
                        Confirm
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setIsConfirmOpen(false)}
                    >
                        Cancel
                    </Button>
                </ModalActions>
            </Modal>
        </>
    );
};

export default NextGroupCard;
