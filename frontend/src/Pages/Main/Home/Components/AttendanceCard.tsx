import { useNavigate } from "react-router-dom";

import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { activityCodeToName } from "@/lib/activities";
import { Room } from "@/lib/interfaces";

interface AttendanceCardProps {
    rooms: Room[];
}
const AttendanceCard = ({ rooms }: AttendanceCardProps) => {
    const activeRounds = rooms.filter((r) => r.currentGroupId);
    const navigate = useNavigate();
    return (
        <Card className="md:row-span-2">
            <CardHeader className="flex flex-col gap-3">
                <CardTitle>Attendance</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-2">
                    {activeRounds.map((room: Room) => (
                        <Button
                            key={room.id}
                            onClick={() => {
                                navigate(`/attendance/${room.currentGroupId}`);
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

export default AttendanceCard;
