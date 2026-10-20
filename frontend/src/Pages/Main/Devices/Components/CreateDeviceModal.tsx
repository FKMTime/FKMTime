import { useEffect, useState } from "react";

import { Modal } from "@/Components/Modal";
import ModalLoading from "@/Components/ModalLoading";
import { useDialogError } from "@/hooks/useDialogError";
import { createDevice } from "@/lib/devices";
import {
    AvailableDevice,
    AvailableDeviceType,
    Device,
    DeviceData,
    DeviceType,
    HardwareVersion,
    Room,
} from "@/lib/interfaces";
import { getAllRooms } from "@/lib/rooms";

import DeviceForm from "./DeviceForm";

interface CreateDeviceModalProps {
    isOpen: boolean;
    onClose: (device?: Device) => void;
    deviceToAdd?: AvailableDevice;
}

const CreateDeviceModal = ({
    isOpen,
    onClose,
    deviceToAdd,
}: CreateDeviceModalProps) => {
    const [error, setError] = useDialogError(isOpen);
    const [isLoading, setIsLoading] = useState(false);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [availableTypes, setAvailableTypes] = useState<DeviceType[]>([
        DeviceType.STATION,
        DeviceType.ATTENDANCE_SCRAMBLER,
        DeviceType.ATTENDANCE_RUNNER,
    ]);

    const handleSubmit = async (data: DeviceData) => {
        setIsLoading(true);
        const { status, device } = await createDevice(data);
        if (status === 201) {
            onClose(device);
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
        signKey: deviceToAdd ? deviceToAdd.signKey : undefined,
        roomId: rooms.length === 1 ? rooms[0].id : "",
        type: deviceToAdd
            ? deviceToAdd.type === AvailableDeviceType.STAFF_ATTENDANCE
                ? DeviceType.ATTENDANCE_SCRAMBLER
                : DeviceType.STATION
            : DeviceType.STATION,
        hwVersion: deviceToAdd
            ? (deviceToAdd.hw.toUpperCase() as HardwareVersion)
            : HardwareVersion.V3,
    };

    return (
        <Modal
            error={error}
            isOpen={isOpen}
            onClose={onClose}
            title="Create device"
        >
            {rooms.length ? (
                <DeviceForm
                    isLoading={isLoading}
                    handleSubmit={handleSubmit}
                    rooms={rooms}
                    availableTypes={availableTypes}
                    availableHwVersions={Object.values(HardwareVersion)}
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
