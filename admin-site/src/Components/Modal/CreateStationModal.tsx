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
import { createStation } from "../../logic/station";
import { Room } from "../../logic/interfaces.ts";
import { getAllRooms } from "../../logic/rooms.ts";

interface CreateStationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CreateStationModal: React.FC<CreateStationModalProps> = ({
    isOpen,
    onClose,
}): JSX.Element => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [rooms, setRooms] = useState<Room[]>([]);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        setIsLoading(true);
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const name = data.get("name") as string;
        const espId = data.get("espId") as string;
        const roomId = data.get("roomId") as string;

        const status = await createStation(name, espId, roomId);
        if (status === 201) {
            toast({
                title: "Successfully created new station.",
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
        getAllRooms().then((rooms: Room[]) => {
            setRooms(rooms);
        });
    }, []);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create station">
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
                    />
                </FormControl>
                <FormControl isRequired>
                    <FormLabel>Room</FormLabel>
                    <Select
                        placeholder="Select room"
                        name="roomId"
                        disabled={isLoading}
                    >
                        {rooms.map((room: Room) => (
                            <option key={room.id} value={room.id}>
                                {room.name}
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

export default CreateStationModal;
