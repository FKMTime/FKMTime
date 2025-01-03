import { Alert, Box, Button } from "@chakra-ui/react";

import { toaster } from "@/Components/ui/toaster";
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
    const handleSubmit = async () => {
        if (!competition) {
            return;
        }
        const status = await updateCompetitionSettings(
            competition.id,
            competition
        );
        if (status === 200) {
            toaster.create({
                title: "Success",
                description: "Competition updated",
                type: "success",
            });
        } else {
            toaster.create({
                title: "Error",
                description: "Something went wrong",
                type: "error",
            });
        }
    };

    const handleSync = async () => {
        if (!competition || !competition.wcaId) {
            return;
        }
        const status = await syncCompetition(competition.wcaId);
        if (status === 200) {
            toaster.create({
                title: "Success",
                description: "Competition synced",
                type: "success",
            });
            await fetchCompetitionDataAndSetAtom();
        } else {
            toaster.create({
                title: "Error",
                description: "Something went wrong",
                type: "error",
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
                        <Alert.Root
                            status="error"
                            borderRadius="md"
                            color="black"
                        >
                            You need to set the scoretaking token taken from WCA
                            Live before the competition
                        </Alert.Root>
                    )}
                    {scoretakingTokenMayExpired && (
                        <Alert.Root
                            status="error"
                            borderRadius="md"
                            color="black"
                        >
                            The scoretaking token may have expired
                        </Alert.Root>
                    )}
                </Box>
            )}
            <Box
                display="flex"
                flexDirection={{ base: "column", md: "row" }}
                gap="2"
            >
                <Button
                    colorPalette="yellow"
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
