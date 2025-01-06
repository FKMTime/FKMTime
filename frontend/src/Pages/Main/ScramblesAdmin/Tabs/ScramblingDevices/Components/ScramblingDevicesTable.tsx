import { Table, TableContainer, Tbody, Th, TableHead, Tr } from "@chakra-ui/react";

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
            <Table >
                <TableHead>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Room</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {devices.map((device) => (
                        <ScramblingDeviceRow
                            key={device.id}
                            device={device}
                            fetchData={fetchData}
                        />
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default ScramblingDevicesTable;
