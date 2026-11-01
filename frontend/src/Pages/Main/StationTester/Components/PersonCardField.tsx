import { useId } from "react";

import PersonAutocomplete from "@/Components/PersonAutocomplete";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { Person } from "@/lib/interfaces";

interface PersonCardFieldProps {
    label: string;
    persons: Person[];
    value: string;
    onChange: (cardId: string) => void;
    /** Resolves to the picked person's card, giving them one if they have none */
    getCard: (person: Person) => Promise<string>;
    required?: boolean;
}

/** Pick a person, or type any card; a typed card selects its owner if it has one */
const PersonCardField = ({
    label,
    persons,
    value,
    onChange,
    getCard,
    required,
}: PersonCardFieldProps) => {
    const id = useId();
    const owner = value
        ? persons.find((person) => person.cardId === value)
        : undefined;

    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={id}>{label}</Label>
            <div className="grid grid-cols-[2fr_1fr] gap-2">
                <PersonAutocomplete
                    // The picker keeps its own selection, so remount to follow the card
                    key={`${owner?.id}-${persons.length}`}
                    defaultValue={owner?.id}
                    personsList={persons}
                    onSelect={async (person) =>
                        onChange(person ? await getCard(person) : "")
                    }
                />
                <Input
                    id={id}
                    type="number"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    required={required}
                />
            </div>
        </div>
    );
};

export default PersonCardField;
