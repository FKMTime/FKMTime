import { Table, TableContainer, Tbody, Th, Thead, Tr } from "@chakra-ui/react";

import { Device } from "@/logic/interfaces";

import DeviceRow from "./DeviceRow";

interface DevicesTableProps {
    devices: Device[];
    fetchData: () => void;
}

const DevicesTable = ({ devices, fetchData }: DevicesTableProps) => {
    return (
        <TableContainer>
            <Table variant="simple">
                <Thead>
                    <Tr bg="gray.400">
                        <Th>Name</Th>
                        <Th>Room</Th>
                        <Th>ESP ID</Th>
                        <Th>Battery</Th>
                        <Th>Type</Th>
                        <Th>Solves</Th>
                        <Th>Actions</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {devices.map((device) => (
                        <DeviceRow
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

export default DevicesTable;
