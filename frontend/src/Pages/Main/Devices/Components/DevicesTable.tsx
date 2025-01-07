import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { AvailableDevice, Device } from "@/lib/interfaces";

import AvailableDeviceRow from "./AvailableDeviceRow";
import DeviceRow from "./DeviceRow";

interface DevicesTableProps {
    devices: Device[];
    availableDevices: AvailableDevice[];
    handleAddDeviceRequest: (device: AvailableDevice) => void;
    handleRemoveDeviceRequest: (deviceEspId: number) => void;

    fetchData: () => void;
}

const DevicesTable = ({
    devices,
    fetchData,
    availableDevices,
    handleAddDeviceRequest,
    handleRemoveDeviceRequest,
}: DevicesTableProps) => {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>ESP ID</TableHead>
                    <TableHead>Battery</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Solves</TableHead>
                    <TableHead>Last update</TableHead>
                    <TableHead>Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {availableDevices.map((device) => (
                    <AvailableDeviceRow
                        key={device.espId}
                        device={device}
                        handleAddDeviceRequest={handleAddDeviceRequest}
                        handleRemoveDeviceRequest={handleRemoveDeviceRequest}
                    />
                ))}
                {devices.map((device) => (
                    <DeviceRow
                        key={device.id}
                        device={device}
                        fetchData={fetchData}
                    />
                ))}
            </TableBody>
        </Table>
    );
};

export default DevicesTable;
