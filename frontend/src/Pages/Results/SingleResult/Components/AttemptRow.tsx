import { IconButton, Td, Tr, useToast } from "@chakra-ui/react";
import { useState } from "react";
import { MdDelete, MdEdit, MdNewLabel } from "react-icons/md";

import Alert from "@/Components/Alert";
import { deleteAttempt } from "@/logic/attempt";
import { Attempt, AttemptStatus, Result } from "@/logic/interfaces";
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
    const toast = useToast();
    const [openConfirmation, setOpenConfirmation] = useState<boolean>(false);
    const [isOpenEditAttemptModal, setIsOpenEditAttemptModal] =
        useState<boolean>(false);
    const [isOpenGiveExtraAttemptModal, setIsOpenGiveExtraAttemptModal] =
        useState<boolean>(false);

    const handleDelete = async () => {
        setOpenConfirmation(true);
    };

    const handleCancel = () => {
        setOpenConfirmation(false);
    };

    const handleConfirm = async () => {
        setOpenConfirmation(false);
        const status = await deleteAttempt(attempt.id);
        if (status === 204) {
            toast({
                title: "Successfully deleted attempt.",
                status: "success",
                duration: 9000,
                isClosable: true,
            });
            fetchData();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                status: "error",
                duration: 9000,
                isClosable: true,
            });
        }
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
                    {attempt.status === AttemptStatus.EXTRA_ATTEMPT
                        ? `Extra ${attempt.attemptNumber}`
                        : attempt.attemptNumber}
                </Td>
                <Td>{attemptWithPenaltyToString(attempt)}</Td>
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
                    {attempt.judge && attempt.judge.name}
                    {attempt.judge &&
                        getPersonNameAndRegistrantId(attempt.judge)}
                </Td>
                <Td>{attempt.device && attempt.device.name}</Td>
                <Td>{attempt.comment}</Td>
                <Td>{new Date(attempt.solvedAt).toLocaleString()}</Td>
                <Td>
                    <IconButton
                        icon={<MdEdit />}
                        aria-label="Edit"
                        bg="none"
                        color="white"
                        _hover={{
                            background: "none",
                            color: "gray.400",
                        }}
                        title="Edit attempt"
                        onClick={() => setIsOpenEditAttemptModal(true)}
                    />
                    {attempt.status === AttemptStatus.STANDARD_ATTEMPT && (
                        <IconButton
                            icon={<MdNewLabel />}
                            aria-label="Delete"
                            bg="none"
                            color="white"
                            _hover={{
                                background: "none",
                                color: "gray.400",
                            }}
                            title="Give extra attempt"
                            onClick={() => setIsOpenGiveExtraAttemptModal(true)}
                        />
                    )}
                    <IconButton
                        icon={<MdDelete />}
                        aria-label="Delete"
                        bg="none"
                        color="white"
                        _hover={{
                            background: "none",
                            color: "gray.400",
                        }}
                        title="Delete attempt"
                        onClick={handleDelete}
                    />
                </Td>
            </Tr>
            <Alert
                isOpen={openConfirmation}
                onCancel={handleCancel}
                onConfirm={handleConfirm}
                title="Delete attempt"
                description="Are you sure you want to delete this attempt? This action cannot be undone"
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
