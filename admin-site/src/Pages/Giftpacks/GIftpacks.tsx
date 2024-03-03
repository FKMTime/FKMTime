import {useEffect, useRef, useState} from "react";
import {Alert, AlertIcon, Box, Button, FormControl, FormLabel, Heading, Input, Text, useToast} from "@chakra-ui/react";
import {Person} from "../../logic/interfaces.ts";
import {
    collectGfitpack,
    getPersonInfoByCardIdWithSensitiveData,
    giftpackCount
} from "../../logic/persons.ts";
import regions from "../../logic/regions.ts";
import LoadingPage from "../../Components/LoadingPage.tsx";

const Giftpacks = () => {
    const toast = useToast();
    const [scannedCard, setScannedCard] = useState<string>("");
    const [totalPersons, setTotalPersons] = useState<number>(0);
    const [collectedGiftpacks, setCollectedGiftpacks] = useState<number>(0);
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cardInputRef: any = useRef();
    const [personData, setPersonData] = useState<Person | null>();

    const handleSubmitCard = async () => {
        const res = await getPersonInfoByCardIdWithSensitiveData(scannedCard);
        if (res.status === 200) {
            if (res.data.giftpackCollectedAt) {
                toast({
                    title: "Giftpack already collected",
                    description: "This competitor already collected the giftpack",
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

    const handleCollectGiftpack = async () => {
        if (!personData) return;
        const res = await collectGfitpack(personData.id);
        if (res.status === 200) {
            toast({
                title: "Success",
                description: "Giftpack collected",
                status: "success",
                duration: 9000,
                isClosable: true,
            });
            setCollectedGiftpacks(res.data.collectedGiftpacksCount);
            setTotalPersons(res.data.totalPersonsCount);
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

    useEffect(() => {
        const fetchData = async () => {
            const data = await giftpackCount();
            setCollectedGiftpacks(data.collectedGiftpacksCount);
            setTotalPersons(data.totalPersonsCount);
        };
        fetchData();
    }, []);

    if (totalPersons === 0) {
        return <LoadingPage/>;
    }
    return (
        <Box display="flex" flexDirection="column" gap="5">
            <Heading size="lg">Giftpacks {`${collectedGiftpacks}/${totalPersons}`}</Heading>
            <Text>Scan the card of the competitor</Text>
            <FormControl display="flex" flexDirection="column" gap="2" width="20%">
                <FormLabel display="flex" flexDirection="row" alignItems="center" gap="2">
                    <Text>Card</Text>
                </FormLabel>
                <Input placeholder="Card" autoFocus _placeholder={{color: "white"}} value={scannedCard}
                       onChange={(event) => setScannedCard(event.target.value)}
                       ref={cardInputRef}
                       onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => event.key === "Enter" && handleSubmitCard()}/>
            </FormControl>
            {personData && (
                <>
                    {(!personData.wcaId || personData.wcaId === "") && (
                        <Alert status='warning' borderRadius="md" color="black" width="25%">
                            <AlertIcon/>
                            Remember to check competitor's ID card
                        </Alert>
                    )}
                    <Text fontSize="2xl" fontWeight="bold">
                        Competitor information
                    </Text>
                    <Text fontSize="xl">
                        Name: {personData.name}
                    </Text>
                    <Text fontSize="xl">
                        Registrant ID: {personData.registrantId}
                    </Text>
                    <Text fontSize="xl">
                        WCA ID: {personData.wcaId ? personData.wcaId : "Newcomer"}
                    </Text>
                    {personData.birthdate && (
                        <Text fontSize="xl">
                            Birthdate: {new Date(personData.birthdate).toLocaleDateString()}
                        </Text>
                    )}
                    <Text fontSize="xl">
                        Representing: {regions.find(region => region.iso2 === personData.countryIso2)?.name}
                    </Text>
                    {personData.giftpackCollectedAt ? (
                        <Alert status='success' borderRadius="md" color="black" width="25%">
                            <AlertIcon/>
                            Giftpack already collected
                        </Alert>
                    ) : (
                        <Button colorScheme="green" width="20%" onClick={handleCollectGiftpack}>
                            Mark giftpack as collected
                        </Button>
                    )}
                </>
            )}
        </Box>
    )
};

export default Giftpacks;
