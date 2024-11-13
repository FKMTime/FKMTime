import { Box, Button } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";

import { activityCodeToName } from "@/logic/activities";
import { ScrambleSet } from "@/logic/interfaces";

interface ScrambleSetsListProps {
    scrambleSets: ScrambleSet[];
}

const ScrambleSetsList: React.FC<ScrambleSetsListProps> = ({
    scrambleSets,
}) => {
    const navigate = useNavigate();
    return (
        <Box display="flex" flexDirection="column" width="fit-content" gap={3}>
            {scrambleSets.map((scrambleSet) => (
                <Button
                    key={scrambleSet.id}
                    onClick={() =>
                        navigate(`/scrambling-device/set/${scrambleSet.id}`)
                    }
                >
                    {activityCodeToName(scrambleSet.roundId)} Set{" "}
                    {scrambleSet.set}
                </Button>
            ))}
        </Box>
    );
};

export default ScrambleSetsList;
