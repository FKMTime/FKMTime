import { Table, TableContainer, Tbody, Th, TableHead, Tr } from "@chakra-ui/react";

import { Attempt, Result } from "@/lib/interfaces";

import AttemptRow from "./AttemptRow";

interface AttemptsTableProps {
    attempts: Attempt[];
    result: Result;
    showExtraColumns?: boolean;
    fetchData: () => void;
}

const AttemptsTable = ({
    attempts,
    showExtraColumns = false,
    fetchData,
    result,
}: AttemptsTableProps) => {
    return (
        <TableContainer overflowX="auto">
            <Table >
                <TableHead>
                    <TableRow>
                        <TableHead>No</TableHead>
                        <TableHead>Attempt number</TableHead>
                        <TableHead>Time</TableHead>
                        {showExtraColumns && (
                            <>
                                <TableHead>Replaced by</TableHead>
                                <TableHead>Status</TableHead>
                            </>
                        )}
                        <TableHead>Judge</TableHead>
                        <TableHead>Scrambler</TableHead>
                        <TableHead>Station</TableHead>
                        <TableHead>Comment</TableHead>
                        <TableHead>Solved at</TableHead>
                        <TableHead>Updated by</TableHead>
                        <TableHead>Actions</TableHead>
                        <TableHead></TableHead>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {attempts.map((attempt: Attempt, i: number) => (
                        <AttemptRow
                            key={attempt.id}
                            attempt={attempt}
                            showExtraColumns={showExtraColumns}
                            fetchData={fetchData}
                            no={i + 1}
                            result={result}
                        />
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default AttemptsTable;
