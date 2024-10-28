import { Table, TableContainer, Tbody, Th, Thead, Tr } from "@chakra-ui/react";

import { ScramblingDevice } from "@/logic/interfaces";

import ScramblingDeviceRow from "./ ScramblingDeviceRow";

interface ScramblingDevicesTableProps {
    devices: ScramblingDevice[];
    fetchData: () => void;
}

const ScramblingDevicesTable = ({
    devices,
    fetchData,
}: ScramblingDevicesTableProps) => {
    return (
        <TableContainer>
            <Table variant="simple">
                <Thead>
                    <Tr bg="gray.400">
                        <Th>Name</Th>
                        <Th>Room</Th>
                        <Th>Actions</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {devices.map((device) => (
                        <ScramblingDeviceRow
                            key={device.id}
                            device={device}
                            fetchData={fetchData}
                        />
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    );
};

export default ScramblingDevicesTable;
