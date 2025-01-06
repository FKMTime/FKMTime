import { Table, TableContainer, Tbody, Th, TableHead, Tr } from "@chakra-ui/react";

import { Device } from "@/lib/interfaces";

import DeviceRow from "./DeviceRow";

interface DevicesTableProps {
    devices: Device[];
    fetchData: () => void;
}

const DevicesTable = ({ devices, fetchData }: DevicesTableProps) => {
    return (
        <TableContainer>
            <Table >
                <TableHead>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>ESP ID</TableHead>
                        <TableHead>Battery</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Solves</TableHead>
                        <TableHead>Last update</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {devices.map((device) => (
                        <DeviceRow
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

export default DevicesTable;
