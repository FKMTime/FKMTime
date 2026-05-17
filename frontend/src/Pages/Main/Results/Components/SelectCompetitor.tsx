import { ChangeEvent } from "react";

import PersonAutocomplete from "@/Components/PersonAutocomplete";
import { Input } from "@/Components/ui/input";
import { Person } from "@/lib/interfaces";

interface SelectCompetitorProps {
    idInputRef: React.RefObject<HTMLInputElement>;
    handleSubmit: () => void;
    persons: Person[];
    onSelect: (person: Person | null) => void;
    inputValue: string;
    setInputValue: (value: string) => void;
    setJustSelected?: (value: boolean) => void;
}

const SelectCompetitor = ({
    idInputRef,
    handleSubmit,
    persons,
    onSelect,
    inputValue,
    setInputValue,
    setJustSelected,
}: SelectCompetitorProps) => {
    const handleSelect = (value: Person | null) => {
        if (!value) return;
        setJustSelected?.(true);
        onSelect(value);
        setInputValue(value.registrantId?.toString() || "");
    };

    const handleChangeIdInput = (event: ChangeEvent<HTMLInputElement>) => {
        setInputValue(event.target.value);
        const selected = persons.find(
            (p) => p.registrantId === +event.target.value
        );
        onSelect(selected || null);
    };

    return (
        <div className="flex gap-3">
            <Input
                placeholder="ID"
                className="w-[20%]"
                width="20%"
                autoFocus
                ref={idInputRef}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        handleSubmit();
                    }
                }}
                value={inputValue}
                onChange={handleChangeIdInput}
                inputMode="numeric"
            />
            <PersonAutocomplete
                onSelect={handleSelect}
                autoFocus
                disabled={false}
                defaultValue={inputValue}
                personsList={persons}
                key={inputValue}
            />
        </div>
    );
};

export default SelectCompetitor;
