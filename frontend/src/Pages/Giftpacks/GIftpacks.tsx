import {
    Alert,
    AlertIcon,
    Box,
    Button,
    FormControl,
    Heading,
    Input,
    Text,
    useToast,
} from "@chakra-ui/react";
import { KeyboardEvent, RefObject, useEffect, useRef, useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import { Person } from "@/logic/interfaces";
import {
    collectGfitpack,
    getPersonInfoByCardIdWithSensitiveData,
    giftpackCount,
} from "@/logic/persons";
import PersonInfo from "@/Pages/Giftpacks/Components/PersonInfo.tsx";
import PersonsWithoutGiftpackCollected from "@/Pages/Giftpacks/Components/PersonsWithoutGiftpackCollected.tsx";

const Giftpacks = () => {
    const toast = useToast();
    const [scannedCard, setScannedCard] = useState<string>("");
    const [totalPersons, setTotalPersons] = useState<number>(0);
    const [collectedGiftpacks, setCollectedGiftpacks] = useState<number>(0);
    const [
        personsWithoutGiftpackCollected,
        setPersonsWithoutGiftpackCollected,
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
        setPersonsWithoutGiftpackCollected(
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
        <Box
            display="flex"
            justifyContent="space-between"
            gap="5"
            flexDirection={{ base: "column", md: "row" }}
        >
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
                        <PersonInfo person={personData} />
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
            <PersonsWithoutGiftpackCollected
                persons={personsWithoutGiftpackCollected}
                handleCollectGiftpack={handleCollectGiftpack}
            />
        </Box>
    );
};

export default Giftpacks;
