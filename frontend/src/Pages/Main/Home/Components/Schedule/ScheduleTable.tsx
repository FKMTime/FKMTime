import { Table } from "@chakra-ui/react";
import { Event } from "@wca/helpers";

import { Activity } from "@/logic/interfaces.ts";

import ScheduleRow from "./ScheduleRow";

interface ScheduleTableProps {
    activities: Activity[];
    events: Event[];
}

const ScheduleTable = ({ activities, events }: ScheduleTableProps) => {
    return (
        <Table.Root>
            <Table.Header textAlign="center">
                <Table.Row>
                    <Table.ColumnHeader>Scheduled time</Table.ColumnHeader>
                    <Table.ColumnHeader title="Real time is calculated based on first and last attempt of table.columnheadere round">
                        Real time
                    </Table.ColumnHeader>
                    <Table.ColumnHeader>Name</Table.ColumnHeader>
                    <Table.ColumnHeader>Format</Table.ColumnHeader>
                    <Table.ColumnHeader>Limit</Table.ColumnHeader>
                    <Table.ColumnHeader>Cutoff</Table.ColumnHeader>
                    <Table.ColumnHeader>Proceed</Table.ColumnHeader>
                    <Table.ColumnHeader>Groups</Table.ColumnHeader>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {activities.map((activity: Activity) => (
                    <ScheduleRow
                        key={activity.id}
                        activity={activity}
                        events={events}
                    />
                ))}
            </Table.Body>
        </Table.Root>
    );
};

export default ScheduleTable;
