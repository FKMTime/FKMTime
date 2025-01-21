import { useNavigate } from "react-router-dom";

import EventRoundAndGroupSelector from "@/Components/EventRoundAndGroupSelector copy";
import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Competition } from "@/lib/interfaces";

interface AttendanceHeaderCardProps {
    competition: Competition;
    selectedEvent: string;
    selectedRound: string;
    selectedGroup: string;
    setSelectedEvent: (eventId: string) => void;
    setSelectedRound: (roundId: string) => void;
    handleGroupChange: (groupId: string) => void;
}
const AttendanceHeaderCard = ({
    competition,
    selectedEvent,
    selectedRound,
    selectedGroup,
    setSelectedEvent,
    setSelectedRound,
    handleGroupChange,
}: AttendanceHeaderCardProps) => {
    const navigate = useNavigate();
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex justify-between items-center">
                    Attendance
                    <Button onClick={() => navigate("/attendance/statistics")}>
                        Statistics
                    </Button>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <EventRoundAndGroupSelector
                    competition={competition}
                    filters={{
                        eventId: selectedEvent,
                        roundId: selectedRound,
                        groupId: selectedGroup,
                    }}
                    handleEventChange={(eventId) => {
                        setSelectedEvent(eventId);
                        setSelectedRound(eventId + "-r1");
                        handleGroupChange(`${eventId}-r1-g1`);
                    }}
                    handleRoundChange={(roundId) => {
                        setSelectedRound(roundId);
                        handleGroupChange(`${roundId}-g1`);
                    }}
                    handleGroupChange={handleGroupChange}
                />
            </CardContent>
        </Card>
    );
};

export default AttendanceHeaderCard;
