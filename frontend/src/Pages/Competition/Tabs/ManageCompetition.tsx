import { Alert, AlertIcon, Box, Button, useToast } from "@chakra-ui/react";
import { FormEvent } from "react";

import {
    syncCompetition,
    updateCompetitionSettings,
} from "@/logic/competition";
import { Competition } from "@/logic/interfaces";

import CompetitionForm from "./Components/CompetitionForm";

interface ManageCompetitionProps {
    competition: Competition;
    setCompetition: (competition: Competition) => void;
    fetchCompetitionDataAndSetAtom: () => void;
}

const ManageCompetition = ({
    competition,
    setCompetition,
    fetchCompetitionDataAndSetAtom,
}: ManageCompetitionProps) => {
    const toast = useToast();

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!competition) {
            return;
        }
        const status = await updateCompetitionSettings(
            competition.id,
            competition
        );
        if (status === 200) {
            toast({
                title: "Success",
                description: "Competition updated",
                status: "success",
            });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                status: "error",
            });
        }
    };

    const handleSync = async () => {
        if (!competition || !competition.wcaId) {
            return;
        }
        const status = await syncCompetition(competition.wcaId);
        if (status === 200) {
            toast({
                title: "Success",
                description: "Competition synced",
                status: "success",
            });
            await fetchCompetitionDataAndSetAtom();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                status: "error",
            });
        }
    };

    const emptyScoretakingToken =
        competition.scoretakingToken === "" || !competition.scoretakingToken;
    const scoretakingTokenMayExpired =
        competition.scoretakingTokenUpdatedAt &&
        new Date(competition.scoretakingTokenUpdatedAt).getTime() <
            new Date().getTime() - 7 * 24 * 60 * 60 * 1000;
    const anyWarnings = emptyScoretakingToken || scoretakingTokenMayExpired;

    return (
        <Box display="flex" flexDirection="column" gap="5" ml="-4">
            {anyWarnings && (
                <Box display="flex" flexDirection="column" gap="5">
                    {emptyScoretakingToken && (
                        <Alert status="error" borderRadius="md" color="black">
                            <AlertIcon />
                            You need to set the scoretaking token taken from WCA
                            Live before the competition
                        </Alert>
                    )}
                    {scoretakingTokenMayExpired && (
                        <Alert status="error" borderRadius="md" color="black">
                            <AlertIcon />
                            The scoretaking token may have expired
                        </Alert>
                    )}
                </Box>
            )}
            <Box
                display="flex"
                flexDirection={{ base: "column", md: "row" }}
                gap="2"
            >
                <Button
                    colorScheme="yellow"
                    onClick={handleSync}
                    width={{ base: "100%", md: "20%" }}
                >
                    Sync
                </Button>
            </Box>
            <CompetitionForm
                competition={competition}
                setCompetition={setCompetition}
                handleSubmit={handleSubmit}
            />
        </Box>
    );
};

export default ManageCompetition;
