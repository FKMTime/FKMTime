import { Box, Button, Heading } from "@chakra-ui/react";
import { Competition, Room } from "../logic/interfaces.ts";
import { getActivityNameByCode, getRoundNameById } from "../logic/utils.ts";
import { useNavigate } from "react-router-dom";

interface HomeShortcutsProps {
    rooms: Room[];
    currentRounds: string[];
    competition: Competition;
}

const HomeShortcuts: React.FC<HomeShortcutsProps> = ({
    rooms,
    currentRounds,
    competition,
}) => {
    const navigate = useNavigate();

    return (
        <>
            <Button
                colorScheme="yellow"
                onClick={() => navigate("/incidents")}
                width={{ base: "100%", md: "20%" }}
            >
                Incidents
            </Button>
            <Heading size="lg">Attendance</Heading>
            <Box display="flex" gap="2" flexWrap="wrap">
                {rooms
                    .filter((r) => r.currentGroupId)
                    .map((room: Room) => (
                        <Button
                            key={room.id}
                            colorScheme="blue"
                            onClick={() => {
                                navigate(`/attendance/${room.currentGroupId}`);
                            }}
                        >
                            {getActivityNameByCode(
                                room.currentGroupId,
                                competition.wcif
                            )}
                        </Button>
                    ))}
            </Box>
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
    );
};

export default HomeShortcuts;
