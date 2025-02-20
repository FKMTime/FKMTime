import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { NoteworthyIncident } from "@/lib/interfaces";

import NoteworthyIncidentRow from "./NoteworthyIncidentRow";

interface NoteworthyIncidentsTableProps {
    data: NoteworthyIncident[];
    fetchData: () => void;
}

const NoteworthyIncidentsTable = ({
    data,
    fetchData,
}: NoteworthyIncidentsTableProps) => {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Attempt</TableHead>
                    <TableHead>Created by</TableHead>
                    <TableHead>Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.map((incident) => (
                    <NoteworthyIncidentRow
                        key={incident.id}
                        incident={incident}
                        fetchData={fetchData}
                    />
                ))}
            </TableBody>
        </Table>
    );
};

export default NoteworthyIncidentsTable;
