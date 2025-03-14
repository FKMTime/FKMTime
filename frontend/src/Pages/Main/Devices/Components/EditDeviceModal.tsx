import { useEffect, useState } from "react";

import { Modal } from "@/Components/Modal";
import { useToast } from "@/hooks/useToast";
import { updateDevice } from "@/lib/devices";
import { Device, DeviceData, DeviceType, Room } from "@/lib/interfaces";
import { getAllRooms } from "@/lib/rooms";

import DeviceForm from "./DeviceForm";

interface EditDeviceModalProps {
    isOpen: boolean;
    onClose: () => void;
    device: Device;
}

const EditDeviceModal = ({ isOpen, onClose, device }: EditDeviceModalProps) => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [rooms, setRooms] = useState<Room[]>([]);

    const handleSubmit = async (data: DeviceData) => {
        setIsLoading(true);

        const status = await updateDevice({
            ...device,
            ...data,
        });
        if (status === 200) {
            toast({
                title: "Successfully updated this device.",
            });
            onClose();
        } else if (status === 409) {
            toast({
                title: "Error",
                description:
                    "Device with this name or ESP ID already exists in database",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
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
        <Modal isOpen={isOpen} onClose={onClose} title="Edit device">
            <DeviceForm
                isLoading={isLoading}
                handleSubmit={handleSubmit}
                rooms={rooms}
                availableTypes={Object.values(DeviceType)}
                defaultValues={device}
                submitText="Edit"
            />
        </Modal>
    );
};

export default EditDeviceModal;
