import { ChevronRight, Plus, SkipForward } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import EventIcon from "@/Components/Icons/EventIcon";
import { Modal } from "@/Components/Modal";
import ModalActions from "@/Components/ModalActions";
import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName, getEventIdFromRoundId } from "@/lib/activities";
import { getRecentAttemptsByRoundId } from "@/lib/attempt";
import { getNextGroupsFromScheduleForRoom } from "@/lib/competition";
import { Attempt, AttemptType, Room } from "@/lib/interfaces";
import { resultToString } from "@/lib/resultFormatters";
import { updateCurrentRound } from "@/lib/rooms";

import QuickEnterAttemptModal from "./QuickEnterAttemptModal";

interface RecentAttempt extends Attempt {
    result: {
        id: string;
        person: { id: string; name: string; registrantId?: number };
    };
}

interface OngoingRoundCardProps {
    roundId: string;
    rooms: Room[];
    onGroupSwitched: () => void;
}

const getAttemptLabel = (attempt: RecentAttempt) => {
    const prefix =
        attempt.type === AttemptType.EXTRA_ATTEMPT
            ? `E${attempt.attemptNumber}.`
            : `${attempt.attemptNumber}.`;
    return `${prefix} ${resultToString(attempt.value)}`;
};

const OngoingRoundCard = ({
    roundId,
    rooms,
    onGroupSwitched,
}: OngoingRoundCardProps) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [recentAttempts, setRecentAttempts] = useState<RecentAttempt[]>([]);
    const [isEnterModalOpen, setIsEnterModalOpen] = useState(false);
    const [isConfirmSwitchOpen, setIsConfirmSwitchOpen] = useState(false);
    const [isSwitching, setIsSwitching] = useState(false);
    const [nextGroupsPreview, setNextGroupsPreview] = useState<
        { room: Room; nextGroups: string[] }[]
    >([]);

    useEffect(() => {
        getRecentAttemptsByRoundId(roundId).then(setRecentAttempts);
    }, [roundId]);

    const relevantRooms = rooms.filter((room) =>
        room.currentGroupIds.some((gid) => gid.startsWith(roundId + "-g"))
    );

    const openSwitchModal = async () => {
        const previews = await Promise.all(
            relevantRooms.map(async (room) => ({
                room,
                nextGroups: await getNextGroupsFromScheduleForRoom(room.id),
            }))
        );
        setNextGroupsPreview(previews);
        setIsConfirmSwitchOpen(true);
    };

    const handleSwitchToNext = async () => {
        setIsSwitching(true);
        try {
            const allRooms = rooms.map((room) => {
                const preview = nextGroupsPreview.find(
                    (p) => p.room.id === room.id
                );
                if (!preview) return room;
                const otherGroups = room.currentGroupIds.filter(
                    (gid) => !gid.startsWith(roundId + "-g")
                );
                return {
                    ...room,
                    currentGroupIds: [...otherGroups, ...preview.nextGroups],
                };
            });
            const result = await updateCurrentRound(allRooms);
            if (result.status === 200) {
                toast({
                    title: "Switched to next from schedule",
                    variant: "success",
                });
                onGroupSwitched();
            } else {
                toast({
                    title: "Failed to switch group",
                    variant: "destructive",
                });
            }
        } catch {
            toast({ title: "Failed to switch group", variant: "destructive" });
        } finally {
            setIsSwitching(false);
            setIsConfirmSwitchOpen(false);
        }
    };

    return (
        <>
            <Card>
                <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                    <CardTitle className="flex gap-1 items-center text-base">
                        <EventIcon
                            selected
                            eventId={getEventIdFromRoundId(roundId)}
                            size={16}
                        />
                        {activityCodeToName(roundId)}
                    </CardTitle>
                    <div className="flex gap-0.5">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Enter attempt"
                            onClick={() => setIsEnterModalOpen(true)}
                        >
                            <Plus size={16} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Switch to next from schedule"
                            onClick={openSwitchModal}
                        >
                            <SkipForward size={16} />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                        <Button
                            size="sm"
                            variant="success"
                            onClick={() =>
                                navigate(`/results/round/${roundId}`)
                            }
                        >
                            Results
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => navigate(`/attendance/${roundId}`)}
                        >
                            Attendance
                        </Button>
                    </div>

                    {recentAttempts.length > 0 && (
                        <div className="flex flex-col gap-0.5">
                            <p className="text-xs text-muted-foreground font-medium mb-0.5">
                                Recent solves
                            </p>
                            {recentAttempts.map((attempt) => (
                                <div
                                    key={attempt.id}
                                    className="group flex items-center justify-between text-sm cursor-pointer hover:bg-muted/60 rounded px-1 -mx-1 py-1 transition-colors"
                                    onClick={() =>
                                        navigate(
                                            `/results/${attempt.result.id}`
                                        )
                                    }
                                >
                                    <span className="min-w-0 truncate">
                                        <span className="font-medium underline underline-offset-2 md:no-underline md:group-hover:underline">
                                            {attempt.result.person.name}
                                        </span>
                                        <span className="text-muted-foreground">
                                            {" "}
                                            — {getAttemptLabel(attempt)}
                                        </span>
                                    </span>
                                    <ChevronRight
                                        size={14}
                                        className="shrink-0 text-muted-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <QuickEnterAttemptModal
                isOpen={isEnterModalOpen}
                onClose={() => setIsEnterModalOpen(false)}
                roundId={roundId}
            />

            <Modal
                isOpen={isConfirmSwitchOpen}
                onClose={() => setIsConfirmSwitchOpen(false)}
                title="Switch to next from schedule"
            >
                <div className="flex flex-col gap-3 text-sm">
                    <p className="text-muted-foreground">
                        Switch <strong>{activityCodeToName(roundId)}</strong> to
                        the next group from the schedule?
                    </p>
                    {nextGroupsPreview.map(({ room, nextGroups }) => (
                        <div key={room.id} className="flex flex-col gap-0.5">
                            <span className="font-medium">{room.name}</span>
                            <span className="text-muted-foreground text-xs">
                                {room.currentGroupIds
                                    .filter((gid) =>
                                        gid.startsWith(roundId + "-g")
                                    )
                                    .map((gid) =>
                                        activityCodeToName(
                                            gid,
                                            false,
                                            true,
                                            true
                                        )
                                    )
                                    .join(", ")}{" "}
                                →{" "}
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
                    ))}
                </div>
                <ModalActions>
                    <Button
                        variant="success"
                        onClick={handleSwitchToNext}
                        disabled={isSwitching}
                    >
                        Confirm
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setIsConfirmSwitchOpen(false)}
                    >
                        Cancel
                    </Button>
                </ModalActions>
            </Modal>
        </>
    );
};

export default OngoingRoundCard;
