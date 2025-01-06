import {
    Alert,
    Box,
    Button,
    Tab,
    TabList,
    TabPanel,
    TabPanels,
    Tabs,
    useToast,
} from "@chakra-ui/react";
import { useState } from "react";

import { Modal } from "@/Components/Modal";
import { AddPerson } from "@/lib/interfaces";
import { addPerson } from "@/lib/persons";

import PersonForm from "./PersonForm";

interface AddPersonModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AddPersonModal = ({ isOpen, onClose }: AddPersonModalProps) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [newPersonData, setNewPersonData] = useState<AddPerson>({
        name: "",
        wcaId: "",
        countryIso2: "",
        cardId: "",
        canCompete: false,
        gender: "",
    });

    const handleSubmit = async () => {
        const status = await addPerson(newPersonData);
        if (status === 201) {
            toast({
                title: "Successfully added new person",
                
            });
            onClose();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
        setIsLoading(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add person">
            <Box
                display="flex"
                flexDirection="column"
                gap="5"
                as="form"
                onSubmit={handleSubmit}
            >
                <Tabs isFitted variant="enclosed">
                    <TabList>
                        <Tab
                            onClick={() =>
                                setNewPersonData({
                                    ...newPersonData,
                                    canCompete: false,
                                })
                            }
                            _selected={{
                                color: "white",
                                bg: "blue.500",
                            }}
                        >
                            Staff member
                        </Tab>
                        <Tab
                            onClick={() =>
                                setNewPersonData({
                                    ...newPersonData,
                                    canCompete: true,
                                })
                            }
                            _selected={{
                                color: "white",
                                bg: "blue.500",
                            }}
                        >
                            Competitor
                        </Tab>
                    </TabList>
                    <TabPanels>
                        <TabPanel>
                            <PersonForm
                                isLoading={isLoading}
                                newPersonData={newPersonData}
                                setNewPersonData={setNewPersonData}
                            />
                        </TabPanel>
                        <TabPanel display="flex" flexDirection="column" gap="5">
                            <Alert status="info" textColor="black">
                                Use this form only if the competitor compete
                                only in unofficial events. If you want to add a
                                competitor who registered on the spot please do
                                it on the WCA Website and sync.
                            </Alert>
                            <PersonForm
                                canCompete
                                isLoading={isLoading}
                                newPersonData={newPersonData}
                                setNewPersonData={setNewPersonData}
                            />
                        </TabPanel>
                    </TabPanels>
                </Tabs>
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
                        isLoading={isLoading}
                        onClick={handleSubmit}
                    >
                        Save
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
};

export default AddPersonModal;
