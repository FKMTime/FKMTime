import { Tr, Td, IconButton, useToast } from "@chakra-ui/react";
import { Attempt } from "../../../logic/interfaces";
import { resultToString } from "../../../logic/resultFormatters";
import { MdDelete, MdEdit } from "react-icons/md";
import { useState } from "react";
import { deleteAttempt } from "../../../logic/attempt";
import Alert from "../../Alert";
import EditAttemptModal from "../../Modal/EditAttemptModal";

interface AttemptRowProps {
    attempt: Attempt;
    showExtraColumns?: boolean;
    fetchData: () => void;
    no: number;
}

const AttemptRow: React.FC<AttemptRowProps> = ({ attempt, showExtraColumns = false, fetchData, no }): JSX.Element => {

    const toast = useToast();
    const [openConfirmation, setOpenConfirmation] = useState<boolean>(false);
    const [isOpenEditAttemptModal, setIsOpenEditAttemptModal] = useState<boolean>(false);

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
                title: "Successfully deleted account.",
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

    const handleCloseEditModal = async () => {
        await fetchData();
        setIsOpenEditAttemptModal(false);
    };

    return (
        <>
            <Tr key={attempt.id}>
                <Td>{no}</Td>
                <Td>{attempt.isExtraAttempt ? `Extra ${attempt.attemptNumber}` : attempt.attemptNumber}</Td>
                <Td>{attempt.penalty < 2 ? resultToString(attempt.value) : (`${resultToString(attempt.value)} + ${attempt.penalty} = ${resultToString((attempt.value + (attempt.penalty * 2000)))}`)}</Td>
                {showExtraColumns && (
                    <>
                        <Td>{attempt.replacedBy && `Extra ${attempt.replacedBy}`}</Td>
                        <Td>{attempt.isDelegate ? attempt.isResolved ? "Resolved" : "Not resolved" : null}</Td>
                    </>
                )}
                <Td>{`${attempt.judge.name} (${attempt.judge.registrantId})`} </Td>
                <Td>{attempt.station.name}</Td>
                <Td>{new Date(attempt.solvedAt).toLocaleString()}</Td>
                <Td>
                    <IconButton icon={<MdEdit />} aria-label="Edit" bg="none" color="white" _hover={{
                        background: "none",
                        color: "gray.400"
                    }}
                        onClick={() => setIsOpenEditAttemptModal(true)}
                    />
                    <IconButton icon={<MdDelete />} aria-label="Delete" bg="none" color="white" _hover={{
                        background: "none",
                        color: "gray.400"
                    }}
                        onClick={handleDelete}
                    />
                </Td>
            </Tr>
            <Alert isOpen={openConfirmation} onCancel={handleCancel} onConfirm={handleConfirm} title="Delete attempt" description="Are you sure you want to delete this attempt? This action cannot be undone" />
            <EditAttemptModal isOpen={isOpenEditAttemptModal} onClose={handleCloseEditModal} attempt={attempt} />
        </>
    )
};

export default AttemptRow;
