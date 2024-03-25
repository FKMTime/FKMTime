import { useEffect, useRef, useState } from "react";
import { Person } from "../../logic/interfaces";
import {
    getPersonsWithoutCardAssigned,
    updatePerson,
} from "../../logic/persons";
import {
    Box,
    DarkMode,
    FormControl,
    Heading,
    Input,
    Text,
    useToast,
} from "@chakra-ui/react";
import {
    AutoComplete,
    AutoCompleteInput,
    AutoCompleteItem,
    AutoCompleteList,
} from "@choc-ui/chakra-autocomplete";

const AssignCards = () => {
    const toast = useToast();
    const [cardId, setCardId] = useState<string>("");
    const [personsWithoutCard, setPersonsWithoutCard] = useState<Person[]>([]);
    const [currentPerson, setCurrentPerson] = useState<Person | null>(null);
    const [searchValue, setSearchValue] = useState<string>("");
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
            setCardId("");
            setSearchValue("");
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
            <DarkMode>
                <FormControl w="60">
                    <AutoComplete
                        openOnFocus
                        onChange={handleChangePerson}
                        value={searchValue}
                    >
                        <AutoCompleteInput
                            autoFocus
                            placeholder="Search for a person"
                            _placeholder={{
                                color: "gray.200",
                            }}
                            ref={searchInputRef}
                            borderColor="white"
                        />
                        <AutoCompleteList>
                            {personsWithoutCard.map((person) => (
                                <AutoCompleteItem
                                    key={person.id}
                                    value={person.id}
                                    label={`${person.name} ${person.registrantId && `(${person.registrantId})`}`}
                                >
                                    {person.name}{" "}
                                    {person.registrantId &&
                                        `(${person.registrantId})`}
                                </AutoCompleteItem>
                            ))}
                        </AutoCompleteList>
                    </AutoComplete>
                </FormControl>
            </DarkMode>
            {currentPerson && (
                <>
                    <Text>Registrant ID: {currentPerson?.registrantId}</Text>
                    <Text>Name: {currentPerson?.name}</Text>
                    <Input
                        placeholder="Card ID"
                        value={cardId}
                        onChange={(e) => setCardId(e.target.value)}
                        width="20%"
                        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                        autoFocus
                        ref={cardInputRef}
                    />
                </>
            )}
        </Box>
    );
};

export default AssignCards;
