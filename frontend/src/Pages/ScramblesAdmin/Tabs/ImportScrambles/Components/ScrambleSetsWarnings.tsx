import {
    Alert,
    AlertIcon,
    AlertTitle,
    Box,
    ListItem,
    Text,
    UnorderedList,
} from "@chakra-ui/react";
import { Competition as WCIF } from "@wca/helpers";

import { getScramblesWarnings } from "@/logic/scramblesImport";

interface ScrambleSetsWarningsProps {
    wcifWithScrambles: WCIF;
    competitionWCIF: WCIF;
}

const ScrambleSetsWarnings = ({
    wcifWithScrambles,
    competitionWCIF,
}: ScrambleSetsWarningsProps) => {
    const warnings = getScramblesWarnings(wcifWithScrambles, competitionWCIF);
    if (warnings.length === 0) return null;
    return (
        <Alert status="warning" borderRadius="md" color="black">
            {" "}
            <Box>
                <AlertTitle display="flex" gap={2}>
                    <AlertIcon m={0} />
                    <Text>Warnings detected during import</Text>
                </AlertTitle>
                <UnorderedList>
                    {warnings.map((warning, i) => (
                        <ListItem key={i}>{warning}</ListItem>
                    ))}
                </UnorderedList>
            </Box>
        </Alert>
    );
};

export default ScrambleSetsWarnings;
