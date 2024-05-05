import {
    Box,
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
    checkedInCount,
    checkIn,
    getPersonInfoByCardIdWithSensitiveData,
} from "@/logic/persons";
import NotCheckedInPersons from "@/Pages/CheckIn/Components/NotCheckedInPersons.tsx";
import PersonInfo from "@/Pages/CheckIn/Components/PersonInfo.tsx";
import SubmitActions from "@/Pages/CheckIn/Components/SubmitActions.tsx";

const CheckIn = () => {
    const toast = useToast();
    const [scannedCard, setScannedCard] = useState<string>("");
    const [totalPersons, setTotalPersons] = useState<number>(0);
    const [personsCheckedIn, setPersonsCheckedIn] = useState<number>(0);
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
            if (res.data.checkedInAt) {
                toast({
                    title: "Something went wrong",
                    description: "Competitor has been already checked in",
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

    const handleCheckIn = async (id?: string) => {
        const idToCheckIn = id ? id : personData?.id;
        if (!idToCheckIn) return;
        const res = await checkIn(idToCheckIn);
        if (res.status === 200) {
            toast({
                title: "Success",
                description: "Competitor checked in successfully",
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

    const handleClickOnList = (id: string) => {
        const person = personsWithoutGiftpackCollected.find((p) => p.id === id);
        setPersonData(person);
        setScannedCard(person?.cardId || "");
    };

    const fetchData = async () => {
        const data = await checkedInCount();
        setPersonsCheckedIn(data.checkedInPersonsCount);
        setTotalPersons(data.totalPersonsCount);
        setPersonsWithoutGiftpackCollected(data.personsWhoDidNotCheckIn);
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
                    Checked in {`${personsCheckedIn}/${totalPersons}`}
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
                        <SubmitActions
                            person={personData}
                            handleCheckIn={handleCheckIn}
                        />
                    </>
                )}
            </Box>
            <NotCheckedInPersons
                persons={personsWithoutGiftpackCollected}
                handleClick={handleClickOnList}
            />
        </Box>
    );
};

export default CheckIn;
