import { IdCard } from "lucide-react";
import { RefObject, useEffect, useRef, useState } from "react";

import PersonAutocomplete from "@/Components/PersonAutocomplete.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Input } from "@/Components/ui/input";
import { useToast } from "@/hooks/useToast";
import { Person } from "@/lib/interfaces";
import { assignCard, getPersonsWithoutCardAssigned } from "@/lib/persons";
import PageTransition from "@/Pages/PageTransition";

const AssignCards = () => {
    const { toast } = useToast();
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
            toast({
                title: "Card assigned",
                variant: "success",
            });
            setCardId("");
            setPersonsWithoutCard(personsWithoutCard - 1);
            setCurrentPerson(null);
            cardInputRef.current?.focus();
            document.getElementById("personAutocompleteSearchInput")?.focus();
        } else if (status === 409) {
            toast({
                title: "Error",
                description: "This card is already assigned to someone else",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
    };

    const handleChangePerson = (value: Person | null) => {
        if (!value) return;
        setCurrentPerson(value);
    };

    return (
        <PageTransition>
            <Card>
                <CardHeader>
                    <CardTitle className="flex gap-2 items-center">
                        <IdCard size={20} />
                        There are {personsWithoutCard} persons without card
                        assigned
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="w-1/3 flex flex-col gap-2">
                        <PersonAutocomplete
                            onSelect={handleChangePerson}
                            withoutCardAssigned={true}
                            autoFocus={true}
                            key={personsWithoutCard}
                            ref={cardInputRef}
                            defaultOpen={true}
                        />

                        {currentPerson && (
                            <Input
                                placeholder="Card ID"
                                value={cardId}
                                onChange={(e) => setCardId(e.target.value)}
                                onKeyDown={(e) =>
                                    e.key === "Enter" && handleSubmit()
                                }
                                autoFocus
                                ref={cardInputRef}
                            />
                        )}
                    </div>
                </CardContent>
            </Card>
        </PageTransition>
    );
};

export default AssignCards;
