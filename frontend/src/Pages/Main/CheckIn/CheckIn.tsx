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
import PersonAutocomplete from "@/Components/PersonAutocomplete";
import { Alert } from "@/Components/ui/alert";
import { Person } from "@/logic/interfaces";
import {
    checkedInCount,
    checkIn,
    getPersonInfoByCardIdWithSensitiveData,
} from "@/logic/persons";
import PersonInfo from "@/Pages/Main/CheckIn/Components/PersonInfo";
import SubmitActions from "@/Pages/Main/CheckIn/Components/SubmitActions";

const CheckIn = () => {
    const toast = useToast();
    const [scannedCard, setScannedCard] = useState<string>("");
    const [totalPersons, setTotalPersons] = useState<number>(0);
    const [personsCheckedIn, setPersonsCheckedIn] = useState<number>(0);
    const cardInputRef: RefObject<HTMLInputElement> =
        useRef<HTMLInputElement>(null);
    const [personData, setPersonData] = useState<Person | null>();
    const [selectedPerson, setSelectedPerson] = useState<Person | null>();
    const [cardShouldBeAssigned, setCardShouldBeAssigned] =
        useState<boolean>(false);

    const handleSubmitCard = async () => {
        if (personData) {
            setPersonData({
                ...personData,
                cardId: scannedCard,
            });
        } else {
            const res =
                await getPersonInfoByCardIdWithSensitiveData(scannedCard);
            if (res.status === 200) {
                if (res.data.checkedInAt) {
                    toast({
                        title: "Something went wrong",
                        description: "Competitor has been already checked in",
                        status: "warning",
                    });
                    setScannedCard("");
                    cardInputRef.current?.focus();
                    return;
                }
                setPersonData(res.data);
                setCardShouldBeAssigned(false);
            } else if (res.status === 404) {
                toast({
                    title: "Card not found",
                    description: "The card was not found in the database.",
                    status: "error",
                });
            } else {
                toast({
                    title: "Error",
                    description: "Something went wrong!",
                    status: "error",
                });
            }
        }
    };

    const handleCheckIn = async (id?: string) => {
        const idToCheckIn = id ? id : personData?.id;
        if (!idToCheckIn) return;
        const res = await checkIn(idToCheckIn, scannedCard);
        if (res.status === 200) {
            toast({
                title: "Success",
                description: `Competitor has been checked in successfully${cardShouldBeAssigned ? " and card was assigned" : ""}.`,
                status: "success",
            });
            await fetchData();
            setPersonData(null);
            setScannedCard("");
            setSelectedPerson(null);
            setCardShouldBeAssigned(false);
            cardInputRef.current?.focus();
        } else if (res.status === 409) {
            toast({
                title: "Card not assigned",
                description: "The card is already assigned to someone.",
                status: "error",
            });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong!",
                status: "error",
            });
        }
    };

    const handleSelectPerson = (person: Person) => {
        setSelectedPerson(person);
        if (!person) {
            toast({
                title: "Already checked in",
                description: "This person has already been checked in",
                status: "warning",
            });
            setTimeout(() => {
                setSelectedPerson(null);
            }, 500);
        }
        setPersonData(person);
        setScannedCard(person?.cardId || "");
        setCardShouldBeAssigned(person?.cardId ? false : true);
        if (!person?.cardId) {
            cardInputRef.current?.focus();
        }
    };

    const fetchData = async () => {
        const data = await checkedInCount();
        setPersonsCheckedIn(data.checkedInPersonsCount);
        setTotalPersons(data.totalPersonsCount);
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
                <PersonAutocomplete
                    onSelect={handleSelectPerson}
                    value={selectedPerson}
                />
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
                        onChange={(event) => {
                            setScannedCard(event.target.value);
                            if (personData?.id) {
                                setPersonData({
                                    ...personData,
                                    cardId: event.target.value,
                                });
                            }
                        }}
                        ref={cardInputRef}
                        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) =>
                            event.key === "Enter" && handleSubmitCard()
                        }
                    />
                </FormControl>
                {personData && (
                    <>
                        {!personData.cardId && (
                            <Alert
                                status="warning"
                                borderRadius="md"
                                color="black"
                            >
                                Please assign a card to the competitor
                            </Alert>
                        )}
                        <PersonInfo person={personData} />
                        <SubmitActions
                            person={personData}
                            handleCheckIn={handleCheckIn}
                            cardShouldBeAssigned={cardShouldBeAssigned}
                        />
                    </>
                )}
            </Box>
        </Box>
    );
};

export default CheckIn;
