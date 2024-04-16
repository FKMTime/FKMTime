import { Box, Heading, useToast } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
    getUpcomingManageableCompetitions,
    importCompetition,
} from "@/logic/competition";
import { WCACompetition } from "@/logic/interfaces";

import CompetitionsList from "./Components/CompetitionsList";

const ImportCompetition = () => {
    const navigate = useNavigate();
    const toast = useToast();
    const [competitions, setCompetitions] = useState<WCACompetition[]>([]);

    const handleSubmit = async (wcaId: string) => {
        if (wcaId === "") {
            toast({
                title: "Error",
                description: "Please enter a competition ID",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        }
        const response = await importCompetition(wcaId);
        if (response.status === 200) {
            navigate(`/competition/`);
        }
    };

    useEffect(() => {
        getUpcomingManageableCompetitions().then((data) => {
            setCompetitions(data);
        });
    }, []);

    return (
        <Box display="flex" flexDirection="column" gap="5" p={5}>
            <Heading size="lg">Import competition from the WCA Website</Heading>
            <Box display="flex" flexDirection="column" gap="5">
                <CompetitionsList
                    competitions={competitions}
                    handleImportCompetition={handleSubmit}
                />
            </Box>
        </Box>
    );
};

export default ImportCompetition;
