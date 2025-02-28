import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { Warning } from "@/lib/interfaces";

import WarningRow from "./WarningRow";

interface WarningsTableProps {
    data: Warning[];
    fetchData: (searchParam?: string) => void;
}

const WarningsTable = ({ data, fetchData }: WarningsTableProps) => {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Person</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Created by</TableHead>
                    <TableHead>Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.map((warning) => (
                    <WarningRow
                        key={warning.id}
                        warning={warning}
                        fetchData={fetchData}
                    />
                ))}
            </TableBody>
        </Table>
    );
};

export default WarningsTable;
