import { useState } from "react";

import DeleteButton from "@/Components/DeleteButton";
import EditButton from "@/Components/EditButton";
import { TableCell, TableRow } from "@/Components/ui/table";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { deleteDevice } from "@/lib/devices";
import { Device } from "@/lib/interfaces";
import { prettyDeviceType } from "@/lib/utils";

import BatteryIcon from "../../../../Components/Icons/BatteryIcon";
import EditDeviceModal from "./EditDeviceModal";

interface DeviceRowProps {
    device: Device;
    fetchData: () => void;
}

const DeviceRow = ({ device, fetchData }: DeviceRowProps) => {
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
                        variant: "success",
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
            <TableRow key={device.id}>
                <TableCell>{device.name}</TableCell>
                <TableCell>{device.espId}</TableCell>
                <TableCell>
                    {device.batteryPercentage ? (
                        <div className="flex items-center gap-1">
                            <BatteryIcon
                                batteryPercentage={device.batteryPercentage}
                            />{" "}
                            <span>{`${device.batteryPercentage}%`}</span>
                        </div>
                    ) : null}
                </TableCell>
                <TableCell>{prettyDeviceType(device.type)}</TableCell>
                <TableCell>{device.count}</TableCell>
                <TableCell>
                    {new Date(device.updatedAt).toLocaleString()}
                </TableCell>
                <TableCell>
                    <EditButton
                        onClick={() => setIsOpenEditDeviceModal(true)}
                    />
                    <DeleteButton onClick={handleDelete} />
                </TableCell>
            </TableRow>
            <EditDeviceModal
                isOpen={isOpenEditDeviceModal}
                onClose={handleCloseEditDeviceModal}
                device={device}
            />
        </>
    );
};

export default DeviceRow;
