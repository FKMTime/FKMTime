import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { ManualIncident } from "@/lib/interfaces";

import ManualIncidentRow from "./ManualIncidentRow";

interface ManualIncidentsTableProps {
    data: ManualIncident[];
    fetchData: () => void;
}

const ManualIncidentsTable = ({
    data,
    fetchData,
}: ManualIncidentsTableProps) => {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Competitor</TableHead>
                    <TableHead>Round</TableHead>
                    <TableHead>Attempt</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Created by</TableHead>
                    <TableHead>Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.map((incident) => (
                    <ManualIncidentRow
                        key={incident.id}
                        incident={incident}
                        fetchData={fetchData}
                    />
                ))}
            </TableBody>
        </Table>
    );
};

export default ManualIncidentsTable;
