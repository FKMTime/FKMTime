import { Box, Button, Heading } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";

import { activityCodeToName } from "@/logic/activities";
import { Room } from "@/logic/interfaces";

interface HomeShortcutsProps {
    rooms: Room[];
    currentRounds: string[];
}

const HomeShortcuts = ({ rooms, currentRounds }: HomeShortcutsProps) => {
    const navigate = useNavigate();
    const showAttendance = rooms.some((r) => r.currentGroupId);
    const activeRounds = rooms.filter((r) => r.currentGroupId);
    const showResults = currentRounds.length > 0;

    return (
        <>
            <Button
                colorScheme="yellow"
                onClick={() => navigate("/incidents")}
                width={{ base: "100%", md: "20%" }}
            >
                Incidents
            </Button>
            {showAttendance && (
                <>
                    <Heading size="lg">Attendance</Heading>
                    <Box display="flex" gap="2" flexWrap="wrap">
                        {activeRounds.map((room: Room) => (
                            <Button
                                key={room.id}
                                colorScheme="blue"
                                onClick={() => {
                                    navigate(
                                        `/attendance/${room.currentGroupId}`
                                    );
                                }}
                            >
                                {activityCodeToName(room.currentGroupId)}
                            </Button>
                        ))}
                    </Box>
                </>
            )}
            {showResults && (
                <>
                    <Heading size="lg">Results</Heading>
                    <Box display="flex" gap="2" flexWrap="wrap">
                        {currentRounds.map((roundId) => (
                            <Button
                                key={roundId}
                                colorScheme="blue"
                                onClick={() => {
                                    navigate(`/results/round/${roundId}`);
                                }}
                            >
                                {activityCodeToName(roundId)}
                            </Button>
                        ))}
                    </Box>
                </>
            )}
        </>
    );
};

export default HomeShortcuts;
