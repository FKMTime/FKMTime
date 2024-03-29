import { Box, Button, Heading, useToast } from "@chakra-ui/react";
import { FormEvent, useState } from "react";

import { importCompetition } from "@/logic/competition";
import { Competition } from "@/logic/interfaces";
import CompetitionsAutocomplete from "@/Pages/Competition/Components/CompetitionsAutocomplete.tsx";

interface ImportCompetitionProps {
    handleImportCompetition: (data: Competition) => void;
}

const ImportCompetition = ({
    handleImportCompetition,
}: ImportCompetitionProps) => {
    const toast = useToast();
    const [competitionId, setCompetitionId] = useState<string>("");
    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (competitionId === "") {
            toast({
                title: "Error",
                description: "Please enter a competition ID",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        }
        const response = await importCompetition(competitionId);
        if (response.status === 200) {
            handleImportCompetition(response.data);
        }
    };

    return (
        <Box display="flex" flexDirection="column" gap="5">
            <Heading size="lg">Import competition from the WCA Website</Heading>
            <Box
                display="flex"
                flexDirection="column"
                gap="5"
                as="form"
                onSubmit={handleSubmit}
                width={{ base: "100%", md: "20%" }}
            >
                <CompetitionsAutocomplete
                    value={competitionId}
                    onSelect={(value) => setCompetitionId(value)}
                />
                <Button colorScheme="green" type="submit">
                    Import
                </Button>
            </Box>
        </Box>
    );
};

export default ImportCompetition;
