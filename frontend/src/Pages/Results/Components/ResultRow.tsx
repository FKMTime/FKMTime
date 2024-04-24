import { IconButton, Td, Tr, useToast } from "@chakra-ui/react";
import { useState } from "react";
import { FaList } from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import { useNavigate } from "react-router-dom";

import Alert from "@/Components/Alert.tsx";
import { isAdmin } from "@/logic/auth";
import { average, formattedBest } from "@/logic/average";
import { Result } from "@/logic/interfaces";
import {
    attemptWithPenaltyToString,
    resultToString,
} from "@/logic/resultFormatters";
import { deleteResultById } from "@/logic/results.ts";
import { getSubmittedAttempts, isMobileView } from "@/logic/utils";

interface ResultRowProps {
    result: Result;
    maxAttempts: number;
    fetchData: (roundId: string, searchParam?: string) => void;
}

const ResultRow = ({ result, maxAttempts, fetchData }: ResultRowProps) => {
    const navigate = useNavigate();
    const toast = useToast();
    const [openConfirmation, setOpenConfirmation] = useState<boolean>(false);

    const submittedAttempts = getSubmittedAttempts(result.attempts);
    const calculatedAverage =
        submittedAttempts.length === maxAttempts && average(submittedAttempts);

    const handleDelete = async () => {
        setOpenConfirmation(true);
    };

    const handleCancel = () => {
        setOpenConfirmation(false);
    };

    const handleConfirm = async () => {
        setOpenConfirmation(false);
        const status = await deleteResultById(result.id);
        if (status === 204) {
            toast({
                title: "Successfully deleted result.",
                status: "success",
                duration: 9000,
                isClosable: true,
            });
            fetchData(result.roundId);
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

    return (
        <>
            <Tr key={result.id}>
                <Td>
                    {result.person.name} ({result.person.registrantId})
                </Td>
                {!isMobileView() &&
                    Array.from({ length: maxAttempts }, (_, i) => (
                        <Td key={i}>
                            {submittedAttempts.length > i
                                ? attemptWithPenaltyToString(
                                      submittedAttempts[i]
                                  )
                                : ""}
                        </Td>
                    ))}
                <Td>
                    {calculatedAverage ? resultToString(calculatedAverage) : ""}
                </Td>
                <Td>{formattedBest(submittedAttempts)}</Td>
                {isAdmin() && (
                    <Td>
                        <IconButton
                            icon={<FaList />}
                            aria-label="List"
                            bg="none"
                            color="white"
                            _hover={{
                                background: "none",
                                color: "gray.400",
                            }}
                            title="View attempts"
                            onClick={() => navigate(`/results/${result.id}`)}
                        />
                        <IconButton
                            icon={<MdDelete />}
                            aria-label="Delete"
                            bg="none"
                            color="white"
                            _hover={{
                                background: "none",
                                color: "gray.400",
                            }}
                            title="Delete result"
                            onClick={handleDelete}
                        />
                    </Td>
                )}
            </Tr>
            <Alert
                isOpen={openConfirmation}
                onCancel={handleCancel}
                onConfirm={handleConfirm}
                title="Delete result"
                description="Are you sure you want to delete this result? This action cannot be undone"
            />
        </>
    );
};

export default ResultRow;
