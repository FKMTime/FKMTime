import { Badge, Box, Td, Tr, useToast } from "@chakra-ui/react";
import { useConfirm } from "chakra-ui-confirm";
import { useState } from "react";
import { MdNewLabel } from "react-icons/md";
import { useNavigate } from "react-router-dom";

import AttemptWarnings from "@/Components/AttemptWarnings";
import DeleteButton from "@/Components/DeleteButton";
import EditButton from "@/Components/EditButton";
import SmallIconButton from "@/Components/SmallIconButton";
import { deleteAttempt } from "@/lib/attempt";
import {
    Attempt,
    AttemptStatus,
    AttemptType,
    Result,
} from "@/lib/interfaces";
import { getPersonNameAndRegistrantId } from "@/lib/persons";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";
import { getResolvedStatus } from "@/logic/utils";

import EditAttemptModal from "./EditAttemptModal";
import GiveExtraAttemptModal from "./GiveExtraAttemptModal";

interface AttemptRowProps {
    attempt: Attempt;
    result: Result;
    showExtraColumns?: boolean;
    fetchData: () => void;
    no: number;
}

const AttemptRow = ({
    attempt,
    showExtraColumns = false,
    fetchData,
    no,
    result,
}: AttemptRowProps) => {
    const navigate = useNavigate();
    const toast = useToast();
    const confirm = useConfirm();
    const [isOpenEditAttemptModal, setIsOpenEditAttemptModal] =
        useState<boolean>(false);
    const [isOpenGiveExtraAttemptModal, setIsOpenGiveExtraAttemptModal] =
        useState<boolean>(false);

    const handleDelete = async () => {
        confirm({
            title: "Delete attempt",
            description:
                "Are you sure you want to delete this attempt? This action cannot be undone",
        })
            .then(async () => {
                const response = await deleteAttempt(attempt.id);
                if (response.status === 200) {
                    toast({
                        title: "Successfully deleted attempt.",
                        
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
                    status: "info",
                });
            });
    };

    const handleCloseModal = async () => {
        fetchData();
        setIsOpenEditAttemptModal(false);
        setIsOpenGiveExtraAttemptModal(false);
    };

    return (
        <>
            <TableRow key={attempt.id}>
                <TableCell>{no}</TableCell>
                <TableCell>
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
                        <TableCell>{getResolvedStatus(attempt.status)}</TableCell>
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
                    <EditButton
                        onClick={() => setIsOpenEditAttemptModal(true)}
                    />
                    <SmallIconButton
                        icon={<MdNewLabel />}
                        ariaLabel="Delete"
                        title="Give extra attempt"
                        onClick={() => setIsOpenGiveExtraAttemptModal(true)}
                    />
                    <DeleteButton onClick={handleDelete} />
                </TableCell>
                <TableCell>
                    <Box display="flex" gap={2}>
                        {!attempt.sessionId &&
                            attempt.status !== AttemptStatus.SCRAMBLED && (
                                <Badge
                                    colorScheme="orange"
                                    borderRadius="md"
                                    p="1"
                                >
                                    Entered manually
                                </Badge>
                            )}
                        <AttemptWarnings attempt={attempt} />
                    </Box>
                </TableCell>
            </TableRow>
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
