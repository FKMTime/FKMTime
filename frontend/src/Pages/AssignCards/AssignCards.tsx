import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Person } from "../../logic/interfaces";
import {
    filterPersons,
    getPersonsWithoutCardAssigned,
    updatePerson,
} from "../../logic/persons";
import { Box, Button, Heading, Input, Text, useToast } from "@chakra-ui/react";

const AssignCards = () => {
    const toast = useToast();
    const [cardId, setCardId] = useState<string>("");
    const [personsWithoutCard, setPersonsWithoutCard] = useState<Person[]>([]);
    const [currentPerson, setCurrentPerson] = useState<Person | null>(null);
    const [search, setSearch] = useState<string>("");
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const searchInputRef: any = useRef();
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cardInputRef: any = useRef();

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
            setSearch("");
            setCardId("");
            setPersonsWithoutCard(
                personsWithoutCard.filter(
                    (person) => person.id !== currentPerson.id
                )
            );
            setCurrentPerson(null);
            searchInputRef.current?.focus();
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

    const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        if (e.target.value === "") setCurrentPerson(null);
        const filteredPersons = filterPersons(
            personsWithoutCard,
            e.target.value
        );
        if (filteredPersons.length === 1) {
            setCurrentPerson(filteredPersons[0]);
            searchInputRef.current?.blur();
        } else if (filteredPersons.length === 0) {
            setCurrentPerson(null);
        }
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
            <Input
                placeholder="Search"
                value={search}
                onChange={handleSearch}
                width="20%"
                autoFocus
                ref={searchInputRef}
            />
            {currentPerson ? (
                <>
                    <Text>Registrant ID: {currentPerson?.registrantId}</Text>
                    <Text>Name: {currentPerson?.name}</Text>
                </>
            ) : (
                <Box
                    display="flex"
                    flexWrap="wrap"
                    gap="2"
                    alignItems="center"
                    justifyContent="center"
                >
                    {filterPersons(personsWithoutCard, search).map((person) => (
                        <Button
                            key={person.id}
                            onClick={() => setCurrentPerson(person)}
                        >
                            {person.name} ({person.registrantId})
                        </Button>
                    ))}
                </Box>
            )}
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
