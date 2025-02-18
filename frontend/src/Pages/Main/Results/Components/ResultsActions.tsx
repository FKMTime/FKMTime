import { useNavigate } from "react-router-dom";

import { Button, buttonVariants } from "@/Components/ui/button";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { reSubmitRoundToWcaLive } from "@/lib/results";
import { getSubmissionPlatformName } from "@/lib/utils";

interface ResultsActionsProps {
    setIsOpenCreateAttemptModal: (value: boolean) => void;
    setIsOpenRestartGroupModal: (value: boolean) => void;
    filters: {
        eventId: string;
        roundId: string;
    };
    resultsLength: number;
}

interface ResultsAction {
    title: string;
    variant: string | typeof buttonVariants;
    onClick: () => void;
    colSpan?: number;
    show?: boolean;
}

const ResultsActions = ({
    setIsOpenCreateAttemptModal,
    setIsOpenRestartGroupModal,
    filters,
    resultsLength,
}: ResultsActionsProps) => {
    const { toast } = useToast();
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
                        variant: "success",
                    });
                } else {
                    toast({
                        title: "Error",
                        description: "Something went wrong",
                        variant: "destructive",
                    });
                }
            })
            .catch(() => {
                toast({
                    title: "Cancelled",
                    description:
                        "You have cancelled the resubmission of the results.",
                });
            });
    };

    const resultsActions: ResultsAction[] = [
        {
            title: "Enter attempt",
            variant: "success",
            onClick: () => setIsOpenCreateAttemptModal(true),
            show: true,
        },
        {
            title: "Public view",
            variant: "secondary",
            onClick: () => navigate(`/results/public/${filters.roundId}`),
            show: true,
        },
        {
            title: "Double check",
            variant: "default",
            onClick: () =>
                navigate(`/results/round/${filters.roundId}/double-check`),
            show: resultsLength > 0,
        },
        {
            title: "Restart group",
            variant: "destructive",
            onClick: () => setIsOpenRestartGroupModal(true),
            show: resultsLength > 0,
        },
        {
            title: `Resubmit results to ${getSubmissionPlatformName(filters.eventId)}`,
            variant: "success",
            onClick: handleResubmitRound,
            colSpan: 2,
            show: true,
        },
    ];
    return (
        <>
            <div className="md:flex hidden gap-5">
                {resultsActions.map(
                    (action) =>
                        action.show && (
                            <Button
                                key={action.title}
                                variant={
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    action.variant as any
                                }
                                onClick={action.onClick}
                            >
                                {action.title}
                            </Button>
                        )
                )}
            </div>
            <div className="md:hidden grid grid-cols-2 gap-3 w-full">
                {resultsActions.map(
                    (action) =>
                        action.show && (
                            <div
                                className={action.colSpan ? "col-span-2" : ""}
                                key={action.title}
                            >
                                <Button
                                    variant={
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        action.variant as any
                                    }
                                    className="w-full break-words"
                                    onClick={action.onClick}
                                >
                                    {action.title}
                                </Button>
                            </div>
                        )
                )}
            </div>
        </>
    );
};

export default ResultsActions;
