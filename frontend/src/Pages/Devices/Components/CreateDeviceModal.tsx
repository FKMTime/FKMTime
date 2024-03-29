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
import { createDevice } from "@/logic/devices";
import { Room } from "@/logic/interfaces";
import { getAllRooms } from "@/logic/rooms";

interface CreateDeviceModalProps {
    isOpen: boolean;
    onClose: () => void;
    espId?: number;
}

const CreateDeviceModal = ({
    isOpen,
    onClose,
    espId,
}: CreateDeviceModalProps) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [roomId, setRoomId] = useState<string>("");
    const [type, setType] = useState<string>("STATION");

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        setIsLoading(true);
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const name = data.get("name") as string;
        const espIdFromForm = data.get("espId") as string;

        const status = await createDevice(name, +espIdFromForm, type, roomId);
        if (status === 201) {
            toast({
                title: "Successfully created new device.",
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
            setRoomId(rooms[0].id);
        });
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create device">
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
                        name="name"
                        disabled={isLoading}
                    />
                </FormControl>
                <FormControl isRequired>
                    <FormLabel>ESP ID</FormLabel>
                    <Input
                        placeholder="ESP ID"
                        type="text"
                        _placeholder={{ color: "white" }}
                        name="espId"
                        disabled={isLoading}
                        defaultValue={espId !== 0 ? espId : ""}
                    />
                </FormControl>
                <FormControl isRequired>
                    <FormLabel>Room</FormLabel>
                    <Select
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value)}
                        disabled={isLoading}
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
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        disabled={isLoading}
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
                        Create
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
};

export default CreateDeviceModal;
