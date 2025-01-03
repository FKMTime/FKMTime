import { Table } from "@chakra-ui/react";

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
            <Table.Root>
                <Table.Header>
                    <Table.Row bg="gray.400">
                        <Table.ColumnHeader>Event</Table.ColumnHeader>
                        <Table.ColumnHeader>Actions</Table.ColumnHeader>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {events.map((event) => (
                        <UnofficialEventRow
                            key={event.id}
                            event={event}
                            fetchData={fetchData}
                        />
                    ))}
                </Table.Body>
            </Table.Root>
        </>
    );
};

export default UnofficialEventsTable;
