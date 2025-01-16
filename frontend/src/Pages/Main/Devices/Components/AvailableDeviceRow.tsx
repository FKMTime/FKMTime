import DeleteButton from "@/Components/DeleteButton";
import PlusButton from "@/Components/PlusButton";
import { TableCell, TableRow } from "@/Components/ui/table";
import { AvailableDevice } from "@/lib/interfaces";
import { prettyDeviceType } from "@/lib/utils";

interface AvailableDeviceRowProps {
    device: AvailableDevice;
    handleAddDeviceRequest: (device: AvailableDevice) => void;
    handleRemoveDeviceRequest: (deviceEspId: number) => void;
}

const AvailableDeviceRow = ({
    device,
    handleAddDeviceRequest,
    handleRemoveDeviceRequest,
}: AvailableDeviceRowProps) => {
    return (
        <>
            <TableRow
                key={device.espId}
                className="bg-primary hover:bg-primary/80"
            >
                <TableCell>New device</TableCell>
                <TableCell>{device.espId}</TableCell>
                <TableCell></TableCell>
                <TableCell>{prettyDeviceType(device.type)}</TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell>
                    <PlusButton
                        onClick={() => handleAddDeviceRequest(device)}
                        variant="ghost"
                    />
                    <DeleteButton
                        onClick={() => handleRemoveDeviceRequest(device.espId)}
                    />
                </TableCell>
            </TableRow>
        </>
    );
};

export default AvailableDeviceRow;
