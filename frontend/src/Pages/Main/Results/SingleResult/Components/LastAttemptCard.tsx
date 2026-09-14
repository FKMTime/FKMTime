import { MessageSquarePlus } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import DeleteButton from "@/Components/DeleteButton";
import EditButton from "@/Components/EditButton";
import SmallIconButton from "@/Components/SmallIconButton";
import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { deleteAttempt, updateAttempt } from "@/lib/attempt";
import { DNF_VALUE, DNS_VALUE, SKIPPED_VALUE } from "@/lib/constants";
import { Attempt, AttemptType, Result } from "@/lib/interfaces";
import { getPersonNameAndRegistrantId } from "@/lib/persons";
import {
    centisecondsToClockFormat,
    milisecondsToClockFormat,
} from "@/lib/resultFormatters";

import EditAttemptModal from "./EditAttemptModal";
import GiveExtraAttemptModal from "./GiveExtraAttemptModal";

interface LastAttemptCardProps {
    result: Result;
    fetchData: () => void;
}

const getAttemptLabel = (attempt: Attempt) => {
    if (attempt.type === AttemptType.EXTRA_ATTEMPT) {
        return `E${attempt.attemptNumber}`;
    }
    return `${attempt.attemptNumber}`;
};

const getDetailedTimeString = (attempt: Attempt) => {
    if (attempt.penalty === DNF_VALUE) {
        if (attempt.value > 0) {
            return `DNF (${centisecondsToClockFormat(attempt.value)})`;
        }
        return "DNF";
    }
    if (attempt.penalty === DNS_VALUE) {
        return "DNS";
    }
    if (attempt.value === SKIPPED_VALUE) return "";
    if (attempt.penalty === 0) {
        return centisecondsToClockFormat(attempt.value);
    }
    return `${centisecondsToClockFormat(attempt.value + attempt.penalty * 100)} (${centisecondsToClockFormat(attempt.value)}+${attempt.penalty})`;
};

const LastAttemptCard = ({ result, fetchData }: LastAttemptCardProps) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const confirm = useConfirm();
    const [isOpenEditAttemptModal, setIsOpenEditAttemptModal] = useState(false);
    const [isOpenGiveExtraAttemptModal, setIsOpenGiveExtraAttemptModal] =
        useState(false);

    const lastAttempt = useMemo(() => {
        if (!result.attempts.length) return null;
        return result.attempts.reduce((latest, attempt) =>
            new Date(attempt.solvedAt) > new Date(latest.solvedAt)
                ? attempt
                : latest
        );
    }, [result.attempts]);

    const handleQuickPenalty = async (penalty: number) => {
        if (!lastAttempt) return;
        const newPenalty = lastAttempt.penalty === penalty ? 0 : penalty;
        const { status, message } = await updateAttempt({
            ...lastAttempt,
            penalty: newPenalty,
        });
        if (status === 200) {
            toast({ title: "Penalty updated", variant: "success" });
            fetchData();
        } else {
            toast({
                title: "Error",
                description: message ?? "Something went wrong",
                variant: "destructive",
            });
        }
    };

    const handleDelete = async () => {
        if (!lastAttempt) return;
        confirm({
            title: "Delete attempt",
            description:
                "Are you sure you want to delete this attempt? This action cannot be undone",
        })
            .then(async () => {
                const response = await deleteAttempt(lastAttempt.id);
                if (response.status === 200) {
                    toast({
                        title: "Successfully deleted attempt.",
                        variant: "success",
                    });
                    if (response.data.resultDeleted) {
                        navigate(`/results/round/${result.roundId}`);
                    } else {
                        fetchData();
                    }
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
                        "You have cancelled the deletion of the attempt.",
                });
            });
    };

    const handleCloseModal = () => {
        fetchData();
        setIsOpenEditAttemptModal(false);
        setIsOpenGiveExtraAttemptModal(false);
    };

    if (!lastAttempt) return null;

    const isPlusTwoPenalty = lastAttempt.penalty === 2;
    const isDnfPenalty = lastAttempt.penalty === DNF_VALUE;

    return (
        <>
            <Card className="w-full">
                <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                        <span>Last attempt</span>
                        <div className="flex gap-1">
                            <EditButton
                                onClick={() => setIsOpenEditAttemptModal(true)}
                            />
                            <SmallIconButton
                                icon={<MessageSquarePlus />}
                                title="Give extra attempt"
                                onClick={() =>
                                    setIsOpenGiveExtraAttemptModal(true)
                                }
                            />
                            <DeleteButton onClick={handleDelete} />
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm">
                            Attempt
                        </span>
                        <span className="font-semibold text-lg">
                            {getAttemptLabel(lastAttempt)}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm">
                            Time
                        </span>
                        <span className="font-mono text-lg font-semibold">
                            {getDetailedTimeString(lastAttempt)}
                        </span>
                    </div>
                    {lastAttempt.originalTime && (
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-sm">
                                Stackmat
                            </span>
                            <span className="font-mono">
                                {milisecondsToClockFormat(
                                    lastAttempt.originalTime
                                )}
                            </span>
                        </div>
                    )}
                    {lastAttempt.inspectionTime &&
                        lastAttempt.inspectionTime >= 15000 && (
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground text-sm">
                                    Inspection
                                </span>
                                <span className="font-mono">
                                    {milisecondsToClockFormat(
                                        lastAttempt.inspectionTime
                                    )}
                                </span>
                            </div>
                        )}
                    {lastAttempt.judge && (
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-sm">
                                Judge
                            </span>
                            <span>
                                {getPersonNameAndRegistrantId(
                                    lastAttempt.judge
                                )}
                            </span>
                        </div>
                    )}
                    <div className="flex gap-2 mt-1">
                        <Button
                            size="sm"
                            variant={isPlusTwoPenalty ? "default" : "outline"}
                            onClick={() => handleQuickPenalty(2)}
                        >
                            +2
                        </Button>
                        <Button
                            size="sm"
                            variant={isDnfPenalty ? "destructive" : "outline"}
                            onClick={() => handleQuickPenalty(DNF_VALUE)}
                        >
                            DNF
                        </Button>
                    </div>
                </CardContent>
            </Card>
            <EditAttemptModal
                isOpen={isOpenEditAttemptModal}
                onClose={handleCloseModal}
                attempt={lastAttempt}
                result={result}
            />
            <GiveExtraAttemptModal
                isOpen={isOpenGiveExtraAttemptModal}
                onClose={handleCloseModal}
                attempt={lastAttempt}
            />
        </>
    );
};

export default LastAttemptCard;
