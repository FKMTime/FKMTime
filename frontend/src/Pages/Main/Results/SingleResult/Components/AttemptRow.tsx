import { Badge, Box, Td, Tr, useToast } from "@chakra-ui/react";
import { useConfirm } from "chakra-ui-confirm";
import { useState } from "react";
import { MdNewLabel } from "react-icons/md";
import { useNavigate } from "react-router-dom";

import AttemptWarnings from "@/Components/AttemptWarnings";
import DeleteButton from "@/Components/DeleteButton";
import EditButton from "@/Components/EditButton";
import SmallIconButton from "@/Components/SmallIconButton";
import { deleteAttempt } from "@/logic/attempt";
import {
    Attempt,
    AttemptStatus,
    AttemptType,
    Result,
} from "@/logic/interfaces";
import { getPersonNameAndRegistrantId } from "@/logic/persons.ts";
import { attemptWithPenaltyToString } from "@/logic/resultFormatters";
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
                        status: "success",
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
                        status: "error",
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
            <Tr key={attempt.id}>
                <Td>{no}</Td>
                <Td>
                    {attempt.type === AttemptType.EXTRA_ATTEMPT
                        ? `Extra ${attempt.attemptNumber}`
                        : attempt.attemptNumber}
                </Td>
                <Td>
                    {attempt.status === AttemptStatus.SCRAMBLED
                        ? "Scrambled, not solved yet"
                        : attemptWithPenaltyToString(attempt)}
                </Td>
                {showExtraColumns && (
                    <>
                        <Td>
                            {attempt.replacedBy &&
                                `Extra ${attempt.replacedBy}`}
                        </Td>
                        <Td>{getResolvedStatus(attempt.status)}</Td>
                    </>
                )}
                <Td>
                    {attempt.judge &&
                        getPersonNameAndRegistrantId(attempt.judge)}
                </Td>
                <Td>
                    {attempt.scrambler &&
                        getPersonNameAndRegistrantId(attempt.scrambler)}
                </Td>
                <Td>{attempt.device && attempt.device.name}</Td>
                <Td>{attempt.comment}</Td>
                <Td>
                    {attempt.status === AttemptStatus.SCRAMBLED
                        ? "Scrambled, not solved yet"
                        : new Date(attempt.solvedAt).toLocaleString()}
                </Td>
                <Td>{attempt.updatedBy?.fullName}</Td>
                <Td>
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
                </Td>
                <Td>
                    <Box display="flex" gap={2}>
                        {!attempt.sessionId &&
                            attempt.status !== AttemptStatus.SCRAMBLED && (
                                <Badge
                                    colorPalette="orange"
                                    borderRadius="md"
                                    p="1"
                                >
                                    Entered manually
                                </Badge>
                            )}
                        <AttemptWarnings attempt={attempt} />
                    </Box>
                </Td>
            </Tr>
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
