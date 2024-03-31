import { Box, Heading, Input, useToast } from "@chakra-ui/react";
import { RefObject, useEffect, useRef, useState } from "react";

import PersonAutocomplete from "@/Components/PersonAutocomplete";
import { Person } from "@/logic/interfaces";
import { getPersonsWithoutCardAssigned, updatePerson } from "@/logic/persons";

const AssignCards = () => {
    const toast = useToast();
    const [cardId, setCardId] = useState<string>("");
    const [personsWithoutCard, setPersonsWithoutCard] = useState<Person[]>([]);
    const [currentPerson, setCurrentPerson] = useState<Person | null>(null);
    const [searchValue, setSearchValue] = useState<string>("");
    const cardInputRef: RefObject<HTMLInputElement> =
        useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchData = async () => {
            const data = await getPersonsWithoutCardAssigned();
            setPersonsWithoutCard(data);
        };
        fetchData();
    }, []);

    const handleSubmit = async () => {
        if (!currentPerson) return;
        const status = await updatePerson({ ...currentPerson, cardId });
        if (status === 200) {
            toast({
                title: "Card assigned",
                status: "success",
                duration: 5000,
                isClosable: true,
            });
            setCardId("");
            setSearchValue("");
            setPersonsWithoutCard(
                personsWithoutCard.filter(
                    (person) => person.id !== currentPerson.id
                )
            );
            setCurrentPerson(null);
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
        setSearchValue(value);
        setCurrentPerson(
            personsWithoutCard.find((person) => person.id === value) || null
        );
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
                There are {personsWithoutCard.length} persons without card
                assigned
            </Heading>
            <Box width={{ base: "100%", md: "20%" }}>
                <PersonAutocomplete
                    onSelect={handleChangePerson}
                    persons={personsWithoutCard}
                    value={searchValue}
                    autoFocus={true}
                />
            </Box>
            {currentPerson && (
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
