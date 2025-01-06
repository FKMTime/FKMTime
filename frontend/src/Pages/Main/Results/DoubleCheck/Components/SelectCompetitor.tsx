import { Box, Input } from "@chakra-ui/react";
import { ChangeEvent } from "react";

import Autocomplete from "@/Components/Autocomplete";
import { ResultToDoubleCheck } from "@/lib/interfaces";

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
    const handleSelect = (value: ResultToDoubleCheck) => {
        setJustSelected(true);
        setResult(value);
        setInputValue(value.person.registrantId?.toString() || "");
    };

    const handleChangeIdInput = (event: ChangeEvent<HTMLInputElement>) => {
        setInputValue(event.target.value);
        const selectedResult = resultsToDoubleCheck.find(
            (r) => r.person.registrantId === +event.target.value
        );
        setResult(selectedResult || null);
    };
    return (
        <Box display="flex" gap={3}>
            <Input
                placeholder="ID"
                width="20%"
                autoFocus
                ref={idInputRef}
                _placeholder={{
                    color: "gray.200",
                }}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        handleSubmit();
                    }
                }}
                value={inputValue}
                onChange={handleChangeIdInput}
            />
            <Autocomplete
                options={resultsToDoubleCheck}
                selectedValue={result}
                onOptionSelect={handleSelect}
                getOptionLabel={(option) => option.person.name}
                placeholder="Search for a person"
                autoFocus
            />
        </Box>
    );
};

export default SelectCompetitor;
