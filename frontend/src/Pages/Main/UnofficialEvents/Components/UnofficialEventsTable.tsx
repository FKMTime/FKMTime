import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { UnofficialEvent } from "@/lib/interfaces";

import UnofficialEventRow from "./UnofficialEventRow";

interface UnofficialEventsTableProps {
    events: UnofficialEvent[];
    fetchData: () => void;
}

const UnofficialEventsTable = ({
    events,
    fetchData,
}: UnofficialEventsTableProps) => {
    return (
        <>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {events.map((event) => (
                        <UnofficialEventRow
                            key={event.id}
                            event={event}
                            fetchData={fetchData}
                        />
                    ))}
                </TableBody>
            </Table>
        </>
    );
};

export default UnofficialEventsTable;
