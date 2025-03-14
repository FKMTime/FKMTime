import { useEffect, useState } from "react";

import { Modal } from "@/Components/Modal";
import ModalLoading from "@/Components/ModalLoading";
import { useToast } from "@/hooks/useToast";
import { createDevice } from "@/lib/devices";
import {
    AvailableDevice,
    AvailableDeviceType,
    DeviceData,
    DeviceType,
    Room,
} from "@/lib/interfaces";
import { getAllRooms } from "@/lib/rooms";

import DeviceForm from "./DeviceForm";

interface CreateDeviceModalProps {
    isOpen: boolean;
    onClose: () => void;
    deviceToAdd?: AvailableDevice;
}

const CreateDeviceModal = ({
    isOpen,
    onClose,
    deviceToAdd,
}: CreateDeviceModalProps) => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [availableTypes, setAvailableTypes] = useState<DeviceType[]>([
        DeviceType.STATION,
        DeviceType.ATTENDANCE_SCRAMBLER,
        DeviceType.ATTENDANCE_RUNNER,
    ]);

    const handleSubmit = async (data: DeviceData) => {
        setIsLoading(true);
        const status = await createDevice(data);
        if (status === 201) {
            toast({
                title: "Successfully created new device.",
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
        if (deviceToAdd) {
            if (deviceToAdd.type === "STAFF_ATTENDANCE") {
                setAvailableTypes([
                    DeviceType.ATTENDANCE_SCRAMBLER,
                    DeviceType.ATTENDANCE_RUNNER,
                ]);
            } else {
                setAvailableTypes([DeviceType.STATION]);
            }
        }
    }, [deviceToAdd, isOpen]);

    const defaultValues: DeviceData = {
        name: "",
        espId: deviceToAdd ? deviceToAdd.espId : 0,
        roomId: rooms.length === 1 ? rooms[0].id : "",
        type: deviceToAdd
            ? deviceToAdd.type === AvailableDeviceType.STAFF_ATTENDANCE
                ? DeviceType.ATTENDANCE_SCRAMBLER
                : DeviceType.STATION
            : DeviceType.STATION,
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create device">
            {rooms.length ? (
                <DeviceForm
                    isLoading={isLoading}
                    handleSubmit={handleSubmit}
                    rooms={rooms}
                    availableTypes={availableTypes}
                    defaultValues={defaultValues}
                    submitText="Add"
                />
            ) : (
                <ModalLoading />
            )}
        </Modal>
    );
};

export default CreateDeviceModal;
