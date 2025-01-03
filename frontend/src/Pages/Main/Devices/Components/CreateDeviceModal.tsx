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
import { AvailableDevice, Room } from "@/logic/interfaces";
import { getAllRooms } from "@/logic/rooms";
import { prettyDeviceType } from "@/logic/utils.ts";

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
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [roomId, setRoomId] = useState<string>("");
    const [availableTypes, setAvailableTypes] = useState<string[]>([
        "STATION",
        "ATTENDANCE_SCRAMBLER",
        "ATTENDANCE_RUNNER",
    ]);
    const [type, setType] = useState<string>("");

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
            setRoomId(data[0].id);
        });
        if (deviceToAdd) {
            if (deviceToAdd.type === "STAFF_ATTENDANCE") {
                setAvailableTypes([
                    "ATTENDANCE_SCRAMBLER",
                    "ATTENDANCE_RUNNER",
                ]);
            } else {
                setAvailableTypes(["STATION"]);
                setType("STATION");
            }
        }
    }, [deviceToAdd, isOpen]);

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
                        autoFocus
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
                        defaultValue={deviceToAdd?.espId || ""}
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
                        disabled={isLoading || availableTypes.length === 1}
                        placeholder="Select type"
                    >
                        {availableTypes.map((availableType: string) => (
                            <option key={availableType} value={availableType}>
                                {prettyDeviceType(availableType)}
                            </option>
                        ))}
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
                        Create
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
};

export default CreateDeviceModal;
