import { Table, TableContainer, Tbody, Th, Thead, Tr } from "@chakra-ui/react";

import { UnofficialEvent } from "@/logic/interfaces";

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
            <TableContainer>
                <Table variant="simple">
                    <Thead>
                        <Tr bg="gray.400">
                            <Th>Event</Th>
                            <Th>Actions</Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {events.map((event) => (
                            <UnofficialEventRow
                                key={event.id}
                                event={event}
                                fetchData={fetchData}
                            />
                        ))}
                    </Tbody>
                </Table>
            </TableContainer>
        </>
    );
};

export default UnofficialEventsTable;
