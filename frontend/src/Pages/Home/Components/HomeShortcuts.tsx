import { Box, Button, Heading } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";

import { Competition, Room } from "@/logic/interfaces";
import { getActivityNameByCode, getRoundNameById } from "@/logic/utils";

interface HomeShortcutsProps {
    rooms: Room[];
    currentRounds: string[];
    competition: Competition;
}

const HomeShortcuts = ({
    rooms,
    currentRounds,
    competition,
}: HomeShortcutsProps) => {
    const navigate = useNavigate();
    const showAttendance = rooms.some((r) => r.currentGroupId);
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
                        {rooms
                            .filter((r) => r.currentGroupId)
                            .map((room: Room) => (
                                <Button
                                    key={room.id}
                                    colorScheme="blue"
                                    onClick={() => {
                                        navigate(
                                            `/attendance/${room.currentGroupId}`
                                        );
                                    }}
                                >
                                    {getActivityNameByCode(
                                        room.currentGroupId,
                                        competition.wcif
                                    )}
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
                                {getRoundNameById(roundId, competition.wcif)}
                            </Button>
                        ))}
                    </Box>
                </>
            )}
        </>
    );
};

export default HomeShortcuts;
