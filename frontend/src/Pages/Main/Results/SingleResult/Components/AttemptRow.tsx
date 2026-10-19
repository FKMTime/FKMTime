import { History, MessageSquarePlus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import AttemptWarnings from "@/Components/AttemptWarnings";
import RowActions from "@/Components/shared/RowActions";
import { Badge } from "@/Components/ui/badge";
import { TableCell, TableRow } from "@/Components/ui/table";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { deleteAttempt } from "@/lib/attempt";
import { Attempt, AttemptStatus, AttemptType, Result } from "@/lib/interfaces";
import { getPersonNameAndRegistrantId } from "@/lib/persons";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";
import { getResolvedStatus } from "@/lib/utils";

import AttemptEditHistoryModal from "./AttemptEditHistoryModal";
import EditAttemptModal from "./EditAttemptModal";
import GiveExtraAttemptModal from "./GiveExtraAttemptModal";

interface AttemptRowProps {
    attempt: Attempt;
    result: Result;
    showExtraColumns?: boolean;
    fetchData: () => void;
}

const AttemptRow = ({
    attempt,
    showExtraColumns = false,
    fetchData,
    result,
}: AttemptRowProps) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const confirm = useConfirm();
    const [isOpenEditAttemptModal, setIsOpenEditAttemptModal] =
        useState<boolean>(false);
    const [isOpenGiveExtraAttemptModal, setIsOpenGiveExtraAttemptModal] =
        useState<boolean>(false);
    const [isOpenHistoryModal, setIsOpenHistoryModal] =
        useState<boolean>(false);

    const handleDelete = async () => {
        confirm({
            title: "Delete this attempt?",
            description: "This action cannot be undone.",
            confirmLabel: "Delete attempt",
        })
            .then(async () => {
                const response = await deleteAttempt(attempt.id);
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
            .catch(() => undefined);
    };

    const handleCloseModal = async () => {
        fetchData();
        setIsOpenEditAttemptModal(false);
        setIsOpenGiveExtraAttemptModal(false);
    };

    return (
        <>
            <TableRow key={attempt.id}>
                <TableCell className="pl-5">
                    {attempt.type === AttemptType.EXTRA_ATTEMPT
                        ? `Extra ${attempt.attemptNumber}`
                        : attempt.attemptNumber}
                </TableCell>
                <TableCell>
                    {attempt.status === AttemptStatus.SCRAMBLED
                        ? "Scrambled, not solved yet"
                        : attemptWithPenaltyToString(attempt)}
                </TableCell>
                {showExtraColumns && (
                    <>
                        <TableCell>
                            {attempt.replacedBy &&
                                `Extra ${attempt.replacedBy}`}
                        </TableCell>
                        <TableCell>
                            {getResolvedStatus(attempt.status)}
                        </TableCell>
                    </>
                )}
                <TableCell>
                    {attempt.judge &&
                        getPersonNameAndRegistrantId(attempt.judge)}
                </TableCell>
                <TableCell>
                    {attempt.scrambler &&
                        getPersonNameAndRegistrantId(attempt.scrambler)}
                </TableCell>
                <TableCell>{attempt.device && attempt.device.name}</TableCell>
                <TableCell>{attempt.comment}</TableCell>
                <TableCell>
                    {attempt.status === AttemptStatus.SCRAMBLED
                        ? "Scrambled, not solved yet"
                        : new Date(attempt.solvedAt).toLocaleString()}
                </TableCell>
                <TableCell>{attempt.updatedBy?.fullName}</TableCell>
                <TableCell>
                    <div className="flex flex-wrap gap-2">
                        {!attempt.sessionId &&
                            attempt.status !== AttemptStatus.SCRAMBLED && (
                                <Badge variant="secondary">
                                    Entered manually
                                </Badge>
                            )}
                        <AttemptWarnings attempt={attempt} />
                    </div>
                </TableCell>
                <TableCell className="pr-3">
                    <RowActions
                        subject={`Attempt ${attempt.attemptNumber}`}
                        primary={{
                            label: "Edit attempt",
                            icon: Pencil,
                            onSelect: () => setIsOpenEditAttemptModal(true),
                        }}
                        items={[
                            {
                                label: "Edit history",
                                icon: History,
                                onSelect: () => setIsOpenHistoryModal(true),
                            },
                            {
                                label: "Give extra attempt",
                                icon: MessageSquarePlus,
                                onSelect: () =>
                                    setIsOpenGiveExtraAttemptModal(true),
                            },
                            {
                                label: "Delete attempt",
                                icon: Trash2,
                                destructive: true,
                                onSelect: handleDelete,
                            },
                        ]}
                    />
                </TableCell>
            </TableRow>
            <AttemptEditHistoryModal
                isOpen={isOpenHistoryModal}
                onClose={() => setIsOpenHistoryModal(false)}
                attemptId={attempt.id}
            />
            <EditAttemptModal
                isOpen={isOpenEditAttemptModal}
                onClose={handleCloseModal}
                attempt={attempt}
                result={result}
            />
            <GiveExtraAttemptModal
                isOpen={isOpenGiveExtraAttemptModal}
                onClose={handleCloseModal}
                attempt={attempt}
            />
        </>
    );
};

export default AttemptRow;
