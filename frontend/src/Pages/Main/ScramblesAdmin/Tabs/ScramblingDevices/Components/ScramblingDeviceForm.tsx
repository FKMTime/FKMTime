import { Box, Button, Input, Select } from "@chakra-ui/react";
import { FormEvent, useEffect, useState } from "react";

import { Room, ScramblingDevice } from "@/logic/interfaces";
import { getAllRooms } from "@/logic/rooms";

interface ScramblingDeviceFormProps {
    onCancel: () => void;
    onSubmit: (device: ScramblingDevice) => void;
    device: ScramblingDevice;
    isLoading: boolean;
}

const ScramblingDeviceForm = ({
    onCancel,
    onSubmit,
    device,
    isLoading,
}: ScramblingDeviceFormProps) => {
    const [editedDevice, setEditedDevice] = useState<ScramblingDevice>(device);
    const [rooms, setRooms] = useState<Room[]>([]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        let deviceToSubmit = editedDevice;
        if (
            (!editedDevice.roomId || editedDevice.roomId === "") &&
            rooms.length > 0
        ) {
            deviceToSubmit = {
                ...editedDevice,
                roomId: rooms[0].id,
            };
        }
        event.preventDefault();
        onSubmit(deviceToSubmit);
    };

    useEffect(() => {
        setEditedDevice(device);
    }, [device]);

    useEffect(() => {
        getAllRooms().then((data: Room[]) => {
            setRooms(data);
        });
    }, []);

    return (
        <Box
            display="flex"
            flexDirection="column"
            gap="5"
            as="form"
            onSubmit={handleSubmit}
        >
            <Input
                placeholder="Name"
                _placeholder={{
                    color: "white",
                }}
                value={editedDevice.name}
                onChange={(e) =>
                    setEditedDevice({
                        ...editedDevice,
                        name: e.target.value,
                    })
                }
            />
            <Select
                disabled={isLoading}
                value={editedDevice.roomId}
                onChange={(e) =>
                    setEditedDevice({
                        ...editedDevice,
                        roomId: e.target.value,
                    })
                }
            >
                {rooms.map((room: Room) => (
                    <option key={room.id} value={room.id}>
                        {room.name}
                    </option>
                ))}
            </Select>
            <Box
                display="flex"
                flexDirection="row"
                justifyContent="end"
                gap="5"
            >
                {!isLoading && (
                    <Button colorPalette="red" onClick={onCancel}>
                        Cancel
                    </Button>
                )}
                <Button colorPalette="green" type="submit" isLoading={isLoading}>
                    Save
                </Button>
            </Box>
        </Box>
    );
};

export default ScramblingDeviceForm;
