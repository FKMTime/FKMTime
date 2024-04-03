import { Box, Heading, Input, useToast } from "@chakra-ui/react";
import { RefObject, useEffect, useRef, useState } from "react";

import PersonAutocomplete from "@/Components/PersonAutocomplete.tsx";
import { assignCard, getPersonsWithoutCardAssigned } from "@/logic/persons";

const AssignCards = () => {
    const toast = useToast();
    const [cardId, setCardId] = useState<string>("");
    const [personsWithoutCard, setPersonsWithoutCard] = useState<number>(0);
    const [currentPersonId, setCurrentPersonId] = useState<string>("");
    const cardInputRef: RefObject<HTMLInputElement> =
        useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchData = async () => {
            const data = await getPersonsWithoutCardAssigned();
            setPersonsWithoutCard(data.count);
        };
        fetchData();
    }, []);

    const handleSubmit = async () => {
        if (!currentPersonId) return;
        const status = await assignCard(currentPersonId, cardId);
        if (status === 200) {
            toast({
                title: "Card assigned",
                status: "success",
                duration: 5000,
                isClosable: true,
            });
            setCardId("");
            setPersonsWithoutCard(personsWithoutCard - 1);
            setCurrentPersonId("");
            document.getElementById("searchInput")?.focus();
        } else if (status === 409) {
            toast({
                title: "Error",
                description: "This card is already assigned to someone else",
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        }
    };

    const handleChangePerson = (value: string) => {
        setCurrentPersonId(value);
    };

    return (
        <Box
            display="flex"
            flexDirection="column"
            gap="5"
            alignItems="center"
            justifyContent="center"
        >
            <Heading size="lg">
                There are {personsWithoutCard} persons without card assigned
            </Heading>
            <Box width={{ base: "100%", md: "20%" }}>
                <PersonAutocomplete
                    onSelect={handleChangePerson}
                    withoutCardAssigned={true}
                    value={currentPersonId}
                    autoFocus={true}
                />
            </Box>
            {currentPersonId && (
                <Input
                    placeholder="Card ID"
                    value={cardId}
                    onChange={(e) => setCardId(e.target.value)}
                    width="20%"
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    autoFocus
                    ref={cardInputRef}
                />
            )}
        </Box>
    );
};

export default AssignCards;
