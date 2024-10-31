import { Box, Button } from "@chakra-ui/react";
import { Competition as WCIF } from "@wca/helpers";
import { useAtomValue } from "jotai";
import { useState } from "react";

import { competitionAtom } from "@/logic/atoms";

import ScrambleSetsList from "./Components/ScrambleSetsList";
import ScrambleSetsWarnings from "./Components/ScrambleSetsWarnings";

const ImportScrambles = () => {
    const [wcif, setWcif] = useState<WCIF>();
    const competition = useAtomValue(competitionAtom);

    const handleFileUpload = () => {
        const file = document.querySelector("input")?.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                setWcif(JSON.parse(result).wcif);
            };
            reader.readAsText(file);
        }
    };

    return (
        <Box display="flex" flexDirection="column" gap="3">
            <input type="file" onChange={handleFileUpload} />
            {wcif && competition && (
                <ScrambleSetsWarnings
                    wcifWithScrambles={wcif}
                    competitionWCIF={competition.wcif}
                />
            )}
            {wcif && <ScrambleSetsList wcif={wcif} />}
            <Box display="flex" gap="3" justifyContent="flex-end">
                <Button
                    colorScheme="red"
                    width={{ base: "100%", md: "fit-content" }}
                >
                    Clear
                </Button>
                <Button
                    colorScheme="green"
                    width={{ base: "100%", md: "fit-content" }}
                >
                    Import
                </Button>
            </Box>
        </Box>
    );
};

export default ImportScrambles;
