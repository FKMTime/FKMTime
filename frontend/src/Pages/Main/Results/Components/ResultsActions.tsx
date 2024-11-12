import { Box, Button, GridItem, SimpleGrid, useToast } from "@chakra-ui/react";
import { useConfirm } from "chakra-ui-confirm";
import { useNavigate } from "react-router-dom";

import { reSubmitRoundToWcaLive } from "@/logic/results";
import { getSubmissionPlatformName } from "@/logic/utils";

interface ResultsActionsProps {
    setIsOpenCreateAttemptModal: (value: boolean) => void;
    setIsOpenRestartGroupModal: (value: boolean) => void;
    filters: {
        eventId: string;
        roundId: string;
    };
    resultsLength: number;
}

const ResultsActions = ({
    setIsOpenCreateAttemptModal,
    setIsOpenRestartGroupModal,
    filters,
    resultsLength,
}: ResultsActionsProps) => {
    const toast = useToast();
    const navigate = useNavigate();
    const confirm = useConfirm();
    const submissionPlatformName = getSubmissionPlatformName(filters.eventId);

    const handleResubmitRound = async () => {
        confirm({
            title: "Resubmit results",
            description: `Are you sure you want to override results from ${submissionPlatformName}?`,
        })
            .then(async () => {
                const status = await reSubmitRoundToWcaLive(filters.roundId);
                if (status === 200) {
                    toast({
                        title: `Successfully resubmitted round results to ${submissionPlatformName}`,
                        status: "success",
                    });
                } else {
                    toast({
                        title: "Error",
                        description: "Something went wrong",
                        status: "error",
                    });
                }
            })
            .catch(() => {
                toast({
                    title: "Cancelled",
                    description:
                        "You have cancelled the resubmission of the results.",
                    status: "info",
                });
            });
    };

    const resultsActions = [
        {
            title: "Enter attempt",
            colorScheme: "green",
            onClick: () => setIsOpenCreateAttemptModal(true),
        },
        {
            title: "Public view",
            colorScheme: "blue",
            onClick: () => navigate(`/results/public/${filters.roundId}`),
        },
        {
            title: "Double check",
            colorScheme: "purple",
            onClick: () =>
                navigate(`/results/round/${filters.roundId}/double-check`),
            resultsLength: resultsLength > 0,
        },
        {
            title: "Restart group",
            colorScheme: "red",
            onClick: () => setIsOpenRestartGroupModal(true),
            resultsLength: resultsLength > 0,
        },
        {
            title: "Resubmit results to WCA Live",
            colorScheme: "yellow",
            onClick: handleResubmitRound,
            colSpan: 2,
        },
    ];
    return (
        <Box
            display="flex"
            gap="3"
            flexDirection={{ base: "column", md: "row" }}
        >
            <SimpleGrid
                gap={3}
                columns={2}
                display={{ base: "grid", md: "none" }}
            >
                {resultsActions.map(
                    (action) =>
                        (!action.resultsLength || resultsLength > 0) && (
                            <GridItem colSpan={action.colSpan || 1}>
                                <Button
                                    key={action.title}
                                    colorScheme={action.colorScheme}
                                    width="100%"
                                    wordBreak="break-word"
                                    onClick={action.onClick}
                                >
                                    {action.title}
                                </Button>
                            </GridItem>
                        )
                )}
            </SimpleGrid>
            <Box display={{ base: "none", md: "flex" }} gap="3">
                {resultsActions.map(
                    (action) =>
                        (!action.resultsLength || resultsLength > 0) && (
                            <Button
                                key={action.title}
                                colorScheme={action.colorScheme}
                                onClick={action.onClick}
                            >
                                {action.title}
                            </Button>
                        )
                )}
            </Box>
        </Box>
    );
};

export default ResultsActions;
