import { Table, TableContainer, Tbody, Th, Thead, Tr } from "@chakra-ui/react";

import { Device } from "@/lib/interfaces";

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
                    <TableRow bg="gray.400">
                        <TableHead>Name</TableHead>
                        <TableHead>ESP ID</TableHead>
                        <TableHead>Battery</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Solves</TableHead>
                        <TableHead>Last update</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </Thead>
                <TableBody>
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
