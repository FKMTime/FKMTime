import { Event } from "@wca/helpers";

import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { Activity } from "@/lib/interfaces";

import ScheduleRow from "./ScheduleRow";

interface ScheduleTableProps {
    activities: Activity[];
    events: Event[];
}

const ScheduleTable = ({ activities, events }: ScheduleTableProps) => {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Scheduled time</TableHead>
                    <TableHead title="Real time is calculated based on first and last attempt of tableheade round">
                        Real time
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Limit</TableHead>
                    <TableHead>Cutoff</TableHead>
                    <TableHead>Proceed</TableHead>
                    <TableHead>Groups</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {activities.map((activity: Activity) => (
                    <ScheduleRow
                        key={activity.id}
                        activity={activity}
                        events={events}
                    />
                ))}
            </TableBody>
        </Table>
    );
};

export default ScheduleTable;
