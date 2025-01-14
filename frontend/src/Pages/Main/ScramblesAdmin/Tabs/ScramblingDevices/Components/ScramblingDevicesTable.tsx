import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
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
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Actions</TableHead>
                </TableRow>
            </TableHeader>
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
    );
};

export default ScramblingDevicesTable;
