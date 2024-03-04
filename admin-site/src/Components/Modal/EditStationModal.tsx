import {
    Box,
    Button,
    FormControl,
    FormLabel,
    Input,
    useToast,
} from "@chakra-ui/react";
import { Modal } from "./Modal";
import { useState } from "react";
import { updateStation } from "../../logic/station";
import { Station } from "../../logic/interfaces";

interface EditStationModalProps {
    isOpen: boolean;
    onClose: () => void;
    station: Station;
}

const EditStationModal: React.FC<EditStationModalProps> = ({
    isOpen,
    onClose,
    station,
}): JSX.Element => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [editedStation, setEditedStation] = useState<Station>(station);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsLoading(true);

        const status = await updateStation(editedStation);
        if (status === 200) {
            toast({
                title: "Successfully updated this station.",
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
                        disabled={isLoading}
                        value={editedStation.name}
                        onChange={(e) =>
                            setEditedStation({
                                ...editedStation,
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
                        value={editedStation.espId}
                        onChange={(e) =>
                            setEditedStation({
                                ...editedStation,
                                espId: e.target.value,
                            })
                        }
                    />
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

export default EditStationModal;
