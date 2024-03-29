import {
    Alert,
    AlertIcon,
    Box,
    Button,
    FormControl,
    Heading,
    IconButton,
    Input,
    ListItem,
    Text,
    UnorderedList,
    useToast,
} from "@chakra-ui/react";
import { KeyboardEvent, RefObject, useEffect, useRef, useState } from "react";
import { MdDone } from "react-icons/md";

import LoadingPage from "@/Components/LoadingPage";
import { Person } from "@/logic/interfaces";
import {
    collectGfitpack,
    getPersonInfoByCardIdWithSensitiveData,
    giftpackCount,
} from "@/logic/persons";
import regions from "@/logic/regions";

const Giftpacks = () => {
    const toast = useToast();
    const [scannedCard, setScannedCard] = useState<string>("");
    const [totalPersons, setTotalPersons] = useState<number>(0);
    const [collectedGiftpacks, setCollectedGiftpacks] = useState<number>(0);
    const [
        personsWhoNotCollectedGitpackYet,
        setPersonsWhoNotCollectedGitpackYet,
    ] = useState<Person[]>([]);
    const cardInputRef: RefObject<HTMLInputElement> =
        useRef<HTMLInputElement>(null);
    const [personData, setPersonData] = useState<Person | null>();

    const handleSubmitCard = async () => {
        const res = await getPersonInfoByCardIdWithSensitiveData(scannedCard);
        if (res.status === 200) {
            if (res.data.giftpackCollectedAt) {
                toast({
                    title: "Giftpack already collected",
                    description:
                        "This competitor already collected the giftpack",
                    status: "warning",
                    duration: 9000,
                    isClosable: true,
                });
                setScannedCard("");
                cardInputRef.current?.focus();
                return;
            }
            setPersonData(res.data);
        } else if (res.status === 404) {
            toast({
                title: "Card not found",
                description: "The card was not found in the database.",
                status: "error",
                duration: 9000,
                isClosable: true,
            });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong!",
                status: "error",
                duration: 9000,
                isClosable: true,
            });
        }
    };

    const handleCollectGiftpack = async (id?: string) => {
        const idToCollect = id ? id : personData?.id;
        if (!idToCollect) return;
        const res = await collectGfitpack(idToCollect);
        if (res.status === 200) {
            toast({
                title: "Success",
                description: "Giftpack collected",
                status: "success",
                duration: 9000,
                isClosable: true,
            });
            await fetchData();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong!",
                status: "error",
                duration: 9000,
                isClosable: true,
            });
        }
        setPersonData(null);
        setScannedCard("");
        cardInputRef.current?.focus();
    };

    const fetchData = async () => {
        const data = await giftpackCount();
        setCollectedGiftpacks(data.collectedGiftpacksCount);
        setTotalPersons(data.totalPersonsCount);
        setPersonsWhoNotCollectedGitpackYet(
            data.personsWithoutGiftpackCollected
        );
    };
    useEffect(() => {
        fetchData();
    }, []);

    if (totalPersons === 0) {
        return <LoadingPage />;
    }
    return (
        <Box display="flex" justifyContent="space-between" gap="5">
            <Box display="flex" flexDirection="column" gap="5">
                <Heading size="lg">
                    Giftpacks {`${collectedGiftpacks}/${totalPersons}`}
                </Heading>
                <Text>Scan the card of the competitor</Text>
                <FormControl
                    display="flex"
                    flexDirection="column"
                    gap="2"
                    width="100%"
                >
                    <Input
                        placeholder="Card"
                        autoFocus
                        _placeholder={{ color: "white" }}
                        value={scannedCard}
                        onChange={(event) => setScannedCard(event.target.value)}
                        ref={cardInputRef}
                        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) =>
                            event.key === "Enter" && handleSubmitCard()
                        }
                    />
                </FormControl>
                {personData && (
                    <>
                        {(!personData.wcaId || personData.wcaId === "") &&
                            personData.canCompete && (
                                <Alert
                                    status="warning"
                                    borderRadius="md"
                                    color="black"
                                >
                                    <AlertIcon />
                                    Remember to check competitor's ID card
                                </Alert>
                            )}
                        <Text fontSize="2xl" fontWeight="bold">
                            Competitor information
                        </Text>
                        <Text fontSize="xl">Name: {personData.name}</Text>
                        {personData.canCompete && (
                            <>
                                <Text fontSize="xl">
                                    Registrant ID: {personData.registrantId}
                                </Text>
                                <Text fontSize="xl">
                                    WCA ID:{" "}
                                    {personData.wcaId
                                        ? personData.wcaId
                                        : "Newcomer"}
                                </Text>
                                {personData.birthdate && (
                                    <Text fontSize="xl">
                                        Birthdate:{" "}
                                        {new Date(
                                            personData.birthdate
                                        ).toLocaleDateString()}
                                    </Text>
                                )}
                                <Text fontSize="xl">
                                    Representing:{" "}
                                    {
                                        regions.find(
                                            (region) =>
                                                region.iso2 ===
                                                personData.countryIso2
                                        )?.name
                                    }
                                </Text>
                            </>
                        )}
                        {personData.giftpackCollectedAt ? (
                            <Alert
                                status="success"
                                borderRadius="md"
                                color="black"
                            >
                                <AlertIcon />
                                Giftpack already collected
                            </Alert>
                        ) : (
                            <Button
                                colorScheme="green"
                                onClick={() => handleCollectGiftpack()}
                            >
                                Mark giftpack as collected
                            </Button>
                        )}
                    </>
                )}
            </Box>
            <Box>
                <Heading size="lg">
                    Persons who not collected giftpack yet
                </Heading>
                <UnorderedList>
                    {personsWhoNotCollectedGitpackYet.map((person) => (
                        <ListItem
                            key={person.id}
                            display="flex"
                            gap="2"
                            alignItems="center"
                        >
                            <IconButton
                                aria-label="Mark as present"
                                rounded="20%"
                                background="none"
                                _hover={{ background: "none", opacity: 0.5 }}
                                color="white"
                                onClick={() => handleCollectGiftpack(person.id)}
                            >
                                <MdDone />
                            </IconButton>
                            {person.name}{" "}
                            {person.registrantId && `(${person.registrantId})`}
                        </ListItem>
                    ))}
                </UnorderedList>
            </Box>
        </Box>
    );
};

export default Giftpacks;
