import { useEffect, useState } from "react";

import { Modal } from "@/Components/Modal";
import { useDialogError } from "@/hooks/useDialogError";
import { updateDevice } from "@/lib/devices";
import {
    Device,
    DeviceData,
    DeviceType,
    HardwareVersion,
    Room,
} from "@/lib/interfaces";
import { getAllRooms } from "@/lib/rooms";

import DeviceForm from "./DeviceForm";

interface EditDeviceModalProps {
    isOpen: boolean;
    onClose: () => void;
    device: Device;
}

const EditDeviceModal = ({ isOpen, onClose, device }: EditDeviceModalProps) => {
    const [error, setError] = useDialogError(isOpen);
    const [isLoading, setIsLoading] = useState(false);
    const [rooms, setRooms] = useState<Room[]>([]);

    const handleSubmit = async (data: DeviceData) => {
        setIsLoading(true);

        const status = await updateDevice({
            ...device,
            ...data,
        });
        if (status === 200) {
            onClose();
        } else if (status === 409) {
            setError(
                "Device with this name or ESP ID already exists in database"
            );
        } else {
            setError("Something went wrong");
        }
        setIsLoading(false);
    };

    useEffect(() => {
        if (!isOpen) return;
        getAllRooms().then((data: Room[]) => {
            setRooms(data);
        });
    }, [isOpen]);

    return (
        <Modal
            error={error}
            isOpen={isOpen}
            onClose={onClose}
            title="Edit device"
        >
            <DeviceForm
                isLoading={isLoading}
                handleSubmit={handleSubmit}
                rooms={rooms}
                availableTypes={Object.values(DeviceType)}
                availableHwVersions={Object.values(HardwareVersion)}
                defaultValues={device}
                submitText="Edit"
            />
        </Modal>
    );
};

export default EditDeviceModal;
