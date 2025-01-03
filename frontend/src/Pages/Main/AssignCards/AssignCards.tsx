import { Box, Heading, Input } from "@chakra-ui/react";
import { RefObject, useEffect, useRef, useState } from "react";

import PersonAutocomplete from "@/Components/PersonAutocomplete.tsx";
import { toaster } from "@/Components/ui/toaster";
import { Person } from "@/logic/interfaces";
import { assignCard, getPersonsWithoutCardAssigned } from "@/logic/persons";

const AssignCards = () => {
    const [cardId, setCardId] = useState<string>("");
    const [personsWithoutCard, setPersonsWithoutCard] = useState<number>(0);
    const [currentPerson, setCurrentPerson] = useState<Person | null>(null);
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
        if (!currentPerson) return;
        const status = await assignCard(currentPerson.id, cardId);
        if (status === 200) {
            toaster.create({
                title: "Card assigned",
                type: "success",
            });
            setCardId("");
            setPersonsWithoutCard(personsWithoutCard - 1);
            setCurrentPerson(null);
            document.getElementById("searchInput")?.focus();
        } else if (status === 409) {
            toaster.create({
                title: "Error",
                description: "This card is already assigned to someone else",
                type: "error",
            });
        } else {
            toaster.create({
                title: "Error",
                description: "Something went wrong",
                type: "error",
            });
        }
    };

    const handleChangePerson = (value: Person) => {
        setCurrentPerson(value);
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
                    value={currentPerson}
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
