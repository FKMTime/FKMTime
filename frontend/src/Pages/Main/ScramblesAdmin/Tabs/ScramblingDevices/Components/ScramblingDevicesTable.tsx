import { Table, TableContainer, Tbody, Th, Thead, Tr } from "@chakra-ui/react";

import { ScramblingDevice } from "@/lib/interfaces";

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
                    <TableRow bg="gray.400">
                        <TableHead>Name</TableHead>
                        <TableHead>Room</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </Thead>
                <TableBody>
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
