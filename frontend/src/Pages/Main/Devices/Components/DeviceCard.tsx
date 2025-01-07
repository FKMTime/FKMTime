import { useState } from "react";

import BatteryIcon from "@/Components/Icons/BatteryIcon";
import { Button } from "@/Components/ui/button";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/Components/ui/card";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { deleteDevice } from "@/lib/devices";
import { Device } from "@/lib/interfaces";
import { prettyDeviceType } from "@/lib/utils";

import EditDeviceModal from "./EditDeviceModal";

interface DeviceCardProps {
    device: Device;
    fetchData: () => void;
}

const DeviceCard = ({ device, fetchData }: DeviceCardProps) => {
    const { toast } = useToast();
    const confirm = useConfirm();
    const [isOpenEditDeviceModal, setIsOpenEditDeviceModal] =
        useState<boolean>(false);

    const handleCloseEditDeviceModal = async () => {
        fetchData();
        setIsOpenEditDeviceModal(false);
    };

    const handleDelete = async () => {
        confirm({
            title: "Delete device",
            description:
                "Are you sure you want to delete this device? This action cannot be undone",
        })
            .then(async () => {
                const status = await deleteDevice(device.id);
                if (status === 204) {
                    toast({
                        title: "Successfully deleted device.",
                    });
                    fetchData();
                } else {
                    toast({
                        title: "Error",
                        description: "Something went wrong",
                        variant: "destructive",
                    });
                }
            })
            .catch(() => {
                toast({
                    title: "Cancelled",
                    description:
                        "You have cancelled the deletion of the device.",
                });
            });
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                        {device.name}
                        {device.batteryPercentage && (
                            <div className="flex items-center">
                                <BatteryIcon
                                    batteryPercentage={device.batteryPercentage}
                                />{" "}
                                <span>{`${device.batteryPercentage}%`}</span>
                            </div>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p>ESP ID: {device.espId}</p>
                    <p>Type: {prettyDeviceType(device.type)}</p>
                    <p>Attempts: {device.count}</p>
                    <p>
                        Updated at:{" "}
                        {new Date(device.updatedAt).toLocaleString()}
                    </p>
                </CardContent>
                <CardFooter className="flex gap-2">
                    <Button onClick={() => setIsOpenEditDeviceModal(true)}>
                        Edit
                    </Button>
                    <Button variant="destructive" onClick={handleDelete}>
                        Delete
                    </Button>
                </CardFooter>
            </Card>
            <EditDeviceModal
                isOpen={isOpenEditDeviceModal}
                onClose={handleCloseEditDeviceModal}
                device={device}
            />
        </>
    );
};

export default DeviceCard;
