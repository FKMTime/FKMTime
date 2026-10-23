import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
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
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="pl-5">Attempt</TableHead>
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
                    <TableHead>Edited by</TableHead>
                    <TableHead>Warnings</TableHead>
                    <TableHead>
                        <span className="sr-only">Actions</span>
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {attempts.map((attempt: Attempt) => (
                    <AttemptRow
                        key={attempt.id}
                        attempt={attempt}
                        showExtraColumns={showExtraColumns}
                        fetchData={fetchData}
                        result={result}
                    />
                ))}
            </TableBody>
        </Table>
    );
};

export default AttemptsTable;
