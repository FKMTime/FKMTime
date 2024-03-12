import { Table, TableContainer, Tbody, Th, Thead, Tr } from "@chakra-ui/react";
import { Device } from "../../logic/interfaces";
import DeviceRow from "./Row/DeviceRow.tsx";

interface DevicesTableProps {
    devices: Device[];
    fetchData: () => void;
}

const DevicesTable: React.FC<DevicesTableProps> = ({ devices, fetchData }) => {
    return (
        <TableContainer>
            <Table variant="simple">
                <Thead>
                    <Tr bg="gray.400">
                        <Th>Name</Th>
                        <Th>Room</Th>
                        <Th>ESP ID</Th>
                        <Th>Type</Th>
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
