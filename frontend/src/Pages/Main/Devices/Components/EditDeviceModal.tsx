import {
    Box,
    Button,
    FormControl,
    FormLabel,
    Input,
    useToast,
} from "@chakra-ui/react";
import { FormEvent, useEffect, useState } from "react";

import { Modal } from "@/Components/Modal";
import Select from "@/Components/Select";
import { updateDevice } from "@/logic/devices";
import { Device, DeviceType, Room } from "@/logic/interfaces";
import { getAllRooms } from "@/logic/rooms";

interface EditDeviceModalProps {
    isOpen: boolean;
    onClose: () => void;
    device: Device;
}

const EditDeviceModal = ({ isOpen, onClose, device }: EditDeviceModalProps) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [editedDevice, setEditedDevice] = useState<Device>(device);
    const [rooms, setRooms] = useState<Room[]>([]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsLoading(true);

        const status = await updateDevice(editedDevice);
        if (status === 200) {
            toast({
                title: "Successfully updated this device.",
                status: "success",
            });
            onClose();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                status: "error",
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
            <Box
                display="flex"
                flexDirection="column"
                gap="5"
                as="form"
                onSubmit={handleSubmit}
            >
                <FormControl isRequired>
                    <FormLabel>Name</FormLabel>
                    <Input
                        placeholder="Name"
                        _placeholder={{ color: "white" }}
                        disabled={isLoading}
                        value={editedDevice.name}
                        onChange={(e) =>
                            setEditedDevice({
                                ...editedDevice,
                                name: e.target.value,
                            })
                        }
                    />
                </FormControl>
                <FormControl isRequired>
                    <FormLabel>ESP ID</FormLabel>
                    <Input
                        placeholder="ESP ID"
                        type="text"
                        _placeholder={{ color: "white" }}
                        disabled={isLoading}
                        value={editedDevice.espId}
                        onChange={(e) =>
                            setEditedDevice({
                                ...editedDevice,
                                espId: +e.target.value,
                            })
                        }
                    />
                </FormControl>
                <FormControl isRequired>
                    <FormLabel>Room</FormLabel>
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
                </FormControl>
                <FormControl isRequired>
                    <FormLabel>Type</FormLabel>
                    <Select
                        disabled={isLoading}
                        value={editedDevice.type}
                        onChange={(e) =>
                            setEditedDevice({
                                ...editedDevice,
                                type: e.target.value as DeviceType,
                            })
                        }
                    >
                        <option value="STATION">Station</option>
                        <option value="ATTENDANCE_SCRAMBLER">
                            Attendance device for scramblers
                        </option>
                        <option value="ATTENDANCE_RUNNER">
                            Attendance device for runners
                        </option>
                    </Select>
                </FormControl>
                <Box
                    display="flex"
                    flexDirection="row"
                    justifyContent="end"
                    gap="5"
                >
                    {!isLoading && (
                        <Button colorPalette="red" onClick={onClose}>
                            Cancel
                        </Button>
                    )}
                    <Button
                        colorPalette="green"
                        type="submit"
                        isLoading={isLoading}
                    >
                        Save
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
};

export default EditDeviceModal;
