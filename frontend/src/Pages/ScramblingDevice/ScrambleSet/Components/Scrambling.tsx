import { Box, Input } from "@chakra-ui/react";

import { DecryptedScramble } from "@/logic/interfaces";

interface ScramblingProps {
    groupId: string;
    scrambles: DecryptedScramble[];
}

const Scrambling = ({ groupId, scrambles }: ScramblingProps) => {
    return (
        <Box>
            <Input
                placeholder="Scan the competitor's card"
                width="fit-content"
            />
        </Box>
    );
};

export default Scrambling;
