import { TableContainer, Table, Thead, Tr, Th, Tbody } from "@chakra-ui/react";
import { Activity } from "@wca/helpers";
import ScheduleRow from "./Row/ScheduleRow";

interface ScheduleTableProps {
    activities: Activity[];
}

const ScheduleTable: React.FC<ScheduleTableProps> = ({ activities }): JSX.Element => {
    return (
        <TableContainer>
            <Table variant='simple'>
                <Thead textAlign="center">
                    <Tr bg='gray.400'>
                        <Th>Time</Th>
                        <Th>Name</Th>
                        <Th>Groups</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {activities.map((activity: Activity) => (
                        <ScheduleRow key={activity.id} activity={activity} />
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    )
};

export default ScheduleTable;
