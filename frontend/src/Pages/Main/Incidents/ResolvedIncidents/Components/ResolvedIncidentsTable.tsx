import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { Incident } from "@/lib/interfaces";

import ResolvedIncidentRow from "./ResolvedIncidentRow";

interface ResolvedIncidentsTableProps {
    data: Incident[];
}

const ResolvedIncidents = ({ data }: ResolvedIncidentsTableProps) => {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Person</TableHead>
                    <TableHead>Round</TableHead>
                    <TableHead>Attempt</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Solved at</TableHead>
                    <TableHead>Updated by</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Comment</TableHead>
                    <TableHead>Judge</TableHead>
                    <TableHead>Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.map((incident) => (
                    <ResolvedIncidentRow
                        key={incident.id}
                        incident={incident}
                    />
                ))}
            </TableBody>
        </Table>
    );
};

export default ResolvedIncidents;
