import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { QuickAction } from "@/lib/interfaces";

import QuickActionRow from "./QuickActionRow";

interface QuickActionsTableProps {
    quickActions: QuickAction[];
    fetchData: () => void;
}

const QuickActionsTable = ({
    quickActions,
    fetchData,
}: QuickActionsTableProps) => {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Comment</TableHead>
                    <TableHead>Give extra attempt</TableHead>
                    <TableHead>Shared with other delegates</TableHead>
                    <TableHead>Created by</TableHead>
                    <TableHead>Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {quickActions.map((quickAction) => (
                    <QuickActionRow
                        key={quickAction.id}
                        quickAction={quickAction}
                        fetchData={fetchData}
                    />
                ))}
            </TableBody>
        </Table>
    );
};

export default QuickActionsTable;
