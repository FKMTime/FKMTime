import { MessageSquarePlus, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/Components/ui/button";
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
import { cn } from "@/lib/utils";

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

    const meta = [
        `Attempt ${getAttemptLabel(lastAttempt)}`,
        lastAttempt.originalTime &&
            `Stackmat ${milisecondsToClockFormat(lastAttempt.originalTime)}`,
        lastAttempt.inspectionTime &&
            lastAttempt.inspectionTime >= 15000 &&
            `Inspection ${milisecondsToClockFormat(lastAttempt.inspectionTime)}`,
    ]
        .filter(Boolean)
        .join(" · ");

    return (
        <>
            <section className="flex flex-col gap-1 rounded-mobile-card border bg-card px-5 py-[18px] md:rounded-2xl">
                <div className="-my-1 flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold text-faint">
                        Last attempt
                    </h3>
                    <div className="-mr-2 flex">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Edit last attempt"
                            title="Edit"
                            onClick={() => setIsOpenEditAttemptModal(true)}
                        >
                            <Pencil />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Give extra attempt"
                            title="Give extra attempt"
                            onClick={() => setIsOpenGiveExtraAttemptModal(true)}
                        >
                            <MessageSquarePlus />
                        </Button>
                        <Button
                            variant="destructive-ghost"
                            size="icon-sm"
                            aria-label="Delete last attempt"
                            title="Delete"
                            onClick={handleDelete}
                        >
                            <Trash2 />
                        </Button>
                    </div>
                </div>
                <p
                    className={cn(
                        "text-2xl font-bold",
                        isDnfPenalty && "text-destructive"
                    )}
                >
                    {getDetailedTimeString(lastAttempt) || "—"}
                </p>
                <p className="text-[13px] text-muted-foreground">{meta}</p>
                {lastAttempt.judge && (
                    <p className="text-[13px] text-muted-foreground">
                        Judge {getPersonNameAndRegistrantId(lastAttempt.judge)}
                    </p>
                )}
                <div className="mt-2 flex gap-2">
                    <Button
                        size="sm"
                        variant={isPlusTwoPenalty ? "default" : "outline"}
                        aria-pressed={isPlusTwoPenalty}
                        onClick={() => handleQuickPenalty(2)}
                    >
                        +2
                    </Button>
                    <Button
                        size="sm"
                        variant={isDnfPenalty ? "destructive" : "outline"}
                        aria-pressed={isDnfPenalty}
                        onClick={() => handleQuickPenalty(DNF_VALUE)}
                    >
                        DNF
                    </Button>
                </div>
            </section>
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
