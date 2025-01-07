import { MdDevices } from "react-icons/md";

import { Button } from "@/Components/ui/button";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/Components/ui/card";
import { AvailableDevice } from "@/lib/interfaces";
import { prettyAvailableDeviceType } from "@/lib/utils";

interface AvailableDeviceCardProps {
    device: AvailableDevice;
    handleAddDeviceRequest: (device: AvailableDevice) => void;
    handleRemoveDeviceRequest: (deviceEspId: number) => void;
}
const AvailableDeviceCard = ({
    device,
    handleAddDeviceRequest,
    handleRemoveDeviceRequest,
}: AvailableDeviceCardProps) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex justify-between items-center">
                    ID: {device.espId}
                    <MdDevices size={48} />
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p>Device ID: {device.espId}</p>
                <p>Type: {prettyAvailableDeviceType(device.type)}</p>
            </CardContent>
            <CardFooter className="flex gap-2">
                <Button
                    variant="success"
                    onClick={() => handleAddDeviceRequest(device)}
                >
                    Add
                </Button>
                <Button
                    variant="destructive"
                    onClick={() => handleRemoveDeviceRequest(device.espId)}
                >
                    Remove
                </Button>
            </CardFooter>
        </Card>
    );
};

export default AvailableDeviceCard;
