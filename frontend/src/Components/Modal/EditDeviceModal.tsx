import {
    Box,
    Button,
    FormControl,
    FormLabel,
    Input,
    Select,
    useToast,
} from "@chakra-ui/react";
import { Modal } from "./Modal";
import { useEffect, useState } from "react";
import { updateDevice } from "../../logic/devices.ts";
import { Device, DeviceType, Room } from "../../logic/interfaces";
import { getAllRooms } from "../../logic/rooms.ts";

interface EditDeviceModalProps {
    isOpen: boolean;
    onClose: () => void;
    device: Device;
}

const EditDeviceModal: React.FC<EditDeviceModalProps> = ({
    isOpen,
    onClose,
    device,
}) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [editedDevice, setEditedDevice] = useState<Device>(device);
    const [rooms, setRooms] = useState<Room[]>([]);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsLoading(true);

        const status = await updateDevice(editedDevice);
        if (status === 200) {
            toast({
                title: "Successfully updated this device.",
                status: "success",
                duration: 9000,
                isClosable: true,
            });
            onClose();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                status: "error",
                duration: 9000,
                isClosable: true,
            });
        }
        setIsLoading(false);
    };

    useEffect(() => {
        if (!isOpen) return;
        getAllRooms().then((rooms: Room[]) => {
            setRooms(rooms);
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
                        placeholder="Select room"
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
                        placeholder="Select type"
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
                        <Button colorScheme="red" onClick={onClose}>
                            Cancel
                        </Button>
                    )}
                    <Button
                        colorScheme="green"
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
