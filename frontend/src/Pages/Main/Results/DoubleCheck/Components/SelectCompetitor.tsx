import { ChangeEvent } from "react";

import PersonAutocomplete from "@/Components/PersonAutocomplete";
import { Input } from "@/Components/ui/input";
import { Person, ResultToDoubleCheck } from "@/lib/interfaces";

interface SelectCompetitorProps {
    idInputRef: React.RefObject<HTMLInputElement>;
    handleSubmit: () => void;
    result: ResultToDoubleCheck | null;
    resultsToDoubleCheck: ResultToDoubleCheck[];
    setResult: (result: ResultToDoubleCheck | null) => void;
    inputValue: string;
    setInputValue: (value: string) => void;
    setJustSelected: (value: boolean) => void;
}

const SelectCompetitor = ({
    idInputRef,
    handleSubmit,
    result,
    resultsToDoubleCheck,
    setResult,
    inputValue,
    setInputValue,
    setJustSelected,
}: SelectCompetitorProps) => {
    const handleSelect = (value: Person | null) => {
        if (!value) return;
        setJustSelected(true);
        const selectedResult = resultsToDoubleCheck.find(
            (r) => r.person.registrantId === value.registrantId
        );
        setResult(selectedResult || null);
        setInputValue(value.registrantId?.toString() || "");
    };

    const handleChangeIdInput = (event: ChangeEvent<HTMLInputElement>) => {
        setInputValue(event.target.value);
        const selectedResult = resultsToDoubleCheck.find(
            (r) => r.person.registrantId === +event.target.value
        );
        setResult(selectedResult || null);
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
            />
            <PersonAutocomplete
                onSelect={handleSelect}
                autoFocus
                disabled={false}
                defaultValue={inputValue}
                personsList={resultsToDoubleCheck.map((r) => r.person)}
            />
        </div>
    );
};

export default SelectCompetitor;
