import { useEffect, useState } from "react";
import { Person } from "../../logic/interfaces";
import { assignManyCards, getPersonsWithoutCardAssigned } from "../../logic/persons";
import { Box, Button, Heading, Input, Text, useToast } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";

const AssignCards = (): JSX.Element => {
    const toast = useToast();
    const navigate = useNavigate();
    const [cardId, setCardId] = useState<string>("");
    const [personsWithoutCard, setPersonsWithoutCard] = useState<Person[]>([]);
    const [personsToSubmit, setPersonsToSubmit] = useState<Person[]>([]);
    const [currentPerson, setCurrentPerson] = useState<Person | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            const data = await getPersonsWithoutCardAssigned();
            setPersonsWithoutCard(data);
            setCurrentPerson(data[0]);
        };
        fetchData();
    }, []);

    const nextPerson = async () => {
        const index = personsWithoutCard.indexOf(currentPerson as Person);
        if (index < personsWithoutCard.length - 1) {
            setPersonsWithoutCard(personsWithoutCard.filter((person) => person.registrantId !== currentPerson?.registrantId));
            setPersonsToSubmit([...personsToSubmit, { ...currentPerson as Person, cardId }]);
            setCurrentPerson(personsWithoutCard[index + 1]);
            setCardId("");
        } else {
            if (confirm("Do you want to save changes?")) {
                const status = await assignManyCards(personsToSubmit);
                if (status === 200) {
                    toast({
                        title: "All persons without card assigned are assigned",
                        status: "success",
                        duration: 5000,
                        isClosable: true,
                    });
                    navigate("/persons");
                } else {
                    toast({
                        title: "Error",
                        description: "Something went wrong",
                        status: "error",
                        duration: 5000,
                        isClosable: true,
                    });
                }
            }
        }
    };

    return (
        <Box display="flex" flexDirection="column" gap="5" alignItems="center" justifyContent="center">
            <Heading size="lg">There are {personsWithoutCard.length} persons without card assigned</Heading>
            <Text>Registrant ID: {currentPerson?.registrantId}</Text>
            <Text>Name: {currentPerson?.name}</Text>
            <Input placeholder="Card ID" value={cardId} onChange={(e) => setCardId(e.target.value)} width="20%" onKeyDown={(e) => e.key === "Enter" && nextPerson()} />
            <Button onClick={nextPerson}>Next</Button>
        </Box>
    )
};

export default AssignCards;
