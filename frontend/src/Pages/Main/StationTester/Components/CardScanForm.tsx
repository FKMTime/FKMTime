import { FormEvent, useState } from "react";

import SwitchRow from "@/Components/shared/SwitchRow";
import { Button } from "@/Components/ui/button";
import { Person } from "@/lib/interfaces";
import { buildCardScanPacket, CardScanFormValues } from "@/lib/stationTester";

import PersonCardField from "./PersonCardField";
import PickOrTypeField from "./PickOrTypeField";

interface CardScanFormProps {
    persons: Person[];
    deviceOptions: { value: string; label: string }[];
    getCard: (person: Person) => Promise<string>;
    onSend: (type: string, data: unknown) => Promise<unknown>;
    isSending: boolean;
}

const CardScanForm = ({
    persons,
    deviceOptions,
    getCard,
    onSend,
    isSending,
}: CardScanFormProps) => {
    const [values, setValues] = useState<CardScanFormValues>({
        card: "",
        espId: deviceOptions[0]?.value ?? "",
        isCompetitor: true,
    });

    const update = (changes: Partial<CardScanFormValues>) =>
        setValues((previous) => ({ ...previous, ...changes }));

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        await onSend("PersonInfo", buildCardScanPacket(values));
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <PersonCardField
                label="Card"
                persons={persons}
                value={values.card}
                onChange={(card) => update({ card })}
                getCard={getCard}
                required
            />
            <PickOrTypeField
                label="Station ESP ID"
                options={deviceOptions}
                value={values.espId}
                onChange={(espId) => update({ espId })}
                placeholder="Select station"
                inputType="number"
                required
            />
            <SwitchRow
                label="Scanned as competitor"
                description="Turn off to scan the card as a judge."
                checked={values.isCompetitor}
                onCheckedChange={(isCompetitor) => update({ isCompetitor })}
            />
            <Button type="submit" disabled={isSending}>
                Scan card
            </Button>
        </form>
    );
};

export default CardScanForm;
