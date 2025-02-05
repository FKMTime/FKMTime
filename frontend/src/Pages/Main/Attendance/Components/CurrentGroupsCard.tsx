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
    const groups = rooms.flatMap((room) => room.currentGroupIds);
    return (
        <Card>
            <CardHeader>
                <CardTitle>Current groups</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-2">
                    {groups.map((group) => (
                        <Button
                            key={group}
                            onClick={() => {
                                setSelectedEvent(group.split("-")[0]);
                                setSelectedRound(group.split("-g")[0]);
                                handleGroupChange(group);
                            }}
                        >
                            {activityCodeToName(group)}
                        </Button>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

export default CurrentGroupsCard;
