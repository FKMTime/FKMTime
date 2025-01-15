import { KeyboardEvent, RefObject, useEffect, useRef, useState } from "react";

import FlagIcon from "@/Components/Icons/FlagIcon";
import LoadingPage from "@/Components/LoadingPage";
import PersonAutocomplete from "@/Components/PersonAutocomplete";
import { Alert, AlertTitle } from "@/Components/ui/alert";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/Components/ui/card";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { useToast } from "@/hooks/useToast";
import { Person } from "@/lib/interfaces";
import {
    checkedInCount,
    checkIn,
    getPersonInfoByCardIdWithSensitiveData,
} from "@/lib/persons";
import { WCA_ORIGIN } from "@/lib/request";

import SubmitActions from "./Components/SubmitActions";

const CheckIn = () => {
    const { toast } = useToast();
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
                    variant: "destructive",
                });
            } else {
                toast({
                    title: "Error",
                    description: "Something went wrong!",
                    variant: "destructive",
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
                variant: "success",
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
                variant: "destructive",
            });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong!",
                variant: "destructive",
            });
        }
    };

    const handleSelectPerson = (person: Person | null) => {
        if (!person) return;
        if (person.checkedInAt) {
            toast({
                title: "Already checked in",
                description: "This person has already been checked in",
            });
            setSelectedPerson(null);
            return;
        }
        setSelectedPerson(person);
        if (!person) {
            toast({
                title: "Already checked in",
                description: "This person has already been checked in",
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
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <CardTitle>
                        Checked in {`${personsCheckedIn}/${totalPersons}`}
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    <PersonAutocomplete
                        onSelect={handleSelectPerson}
                        defaultValue={selectedPerson?.id}
                        key={selectedPerson?.id}
                    />
                    <div className="flex flex-col gap-2">
                        <Label>Scan the card of the competitor</Label>
                        <Input
                            placeholder="Card"
                            autoFocus
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
                            onKeyDown={(
                                event: KeyboardEvent<HTMLInputElement>
                            ) => event.key === "Enter" && handleSubmitCard()}
                        />
                    </div>
                </CardContent>
            </Card>
            {personData ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex justify-between items-center">
                            {personData.name}{" "}
                            {personData.registrantId
                                ? `(${personData.registrantId})`
                                : ""}
                            <FlagIcon
                                country={personData.countryIso2}
                                size={40}
                            />
                        </CardTitle>
                        <CardDescription>
                            <p>
                                {personData.wcaId ? (
                                    <a
                                        className="text-blue-500"
                                        href={`${WCA_ORIGIN}/persons/${personData.wcaId}`}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        {personData.wcaId}
                                    </a>
                                ) : (
                                    "Newcomer"
                                )}
                            </p>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        {!personData.cardId ? (
                            <Alert variant="destructive">
                                <AlertTitle>
                                    Please assign a card to the competitor
                                </AlertTitle>
                            </Alert>
                        ) : null}
                        <SubmitActions
                            person={personData}
                            handleCheckIn={handleCheckIn}
                            cardShouldBeAssigned={cardShouldBeAssigned}
                        />
                    </CardContent>
                </Card>
            ) : null}
        </div>
    );
};

export default CheckIn;
