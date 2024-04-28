import { Table, TableContainer, Tbody, Th, Thead, Tr } from "@chakra-ui/react";
import { Event } from "@wca/helpers";

import { Activity } from "@/logic/interfaces.ts";

import ScheduleRow from "./ScheduleRow";

interface ScheduleTableProps {
    activities: Activity[];
    events: Event[];
}

const ScheduleTable = ({ activities, events }: ScheduleTableProps) => {
    return (
        <TableContainer>
            <Table variant="simple">
                <Thead textAlign="center">
                    <Tr bg="gray.400">
                        <Th>Scheduled time</Th>
                        <Th title="Real time is calculated based on first and last attempt of the round">
                            Real time
                        </Th>
                        <Th>Name</Th>
                        <Th>Format</Th>
                        <Th>Limit</Th>
                        <Th>Cutoff</Th>
                        <Th>Proceed</Th>
                        <Th>Groups</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {activities.map((activity: Activity) => (
                        <ScheduleRow
                            key={activity.id}
                            activity={activity}
                            events={events}
                        />
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    );
};

export default ScheduleTable;
