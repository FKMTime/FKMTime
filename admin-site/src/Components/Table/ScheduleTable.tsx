import { TableContainer, Table, Thead, Tr, Th, Tbody } from "@chakra-ui/react";
import { Activity, Event } from "@wca/helpers";
import ScheduleRow from "./Row/ScheduleRow";

interface ScheduleTableProps {
    activities: Activity[];
    events: Event[];
}

const ScheduleTable: React.FC<ScheduleTableProps> = ({ activities, events }): JSX.Element => {
    return (
        <TableContainer>
            <Table variant='simple'>
                <Thead textAlign="center">
                    <Tr bg='gray.400'>
                        <Th>Time</Th>
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
                        <ScheduleRow key={activity.id} activity={activity} events={events} />
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    )
};

export default ScheduleTable;
