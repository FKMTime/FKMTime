import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { activityCodeToName } from "@/lib/activities";
import { Room } from "@/lib/interfaces";

interface CurrentGroupsCardProps {
    rooms: Room[];
    setSelectedEvent: (eventId: string) => void;
    setSelectedRound: (roundId: string) => void;
    handleGroupChange: (groupId: string) => void;
}

const CurrentGroupsCard = ({
    rooms,
    setSelectedEvent,
    setSelectedRound,
    handleGroupChange,
}: CurrentGroupsCardProps) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Current groups</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-2">
                    {rooms
                        .filter((r) => r.currentGroupId)
                        .map((room: Room) => (
                            <Button
                                key={room.id}
                                onClick={() => {
                                    setSelectedEvent(
                                        room.currentGroupId.split("-")[0]
                                    );
                                    setSelectedRound(
                                        room.currentGroupId.split("-g")[0]
                                    );
                                    handleGroupChange(room.currentGroupId);
                                }}
                            >
                                {activityCodeToName(room.currentGroupId)}
                            </Button>
                        ))}
                </div>
            </CardContent>
        </Card>
    );
};

export default CurrentGroupsCard;
