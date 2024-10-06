import { Box, DarkMode, FormControl, Input } from "@chakra-ui/react";
import {
    AutoComplete,
    AutoCompleteInput,
    AutoCompleteItem,
    AutoCompleteList,
} from "@choc-ui/chakra-autocomplete";
import { ChangeEvent } from "react";

import { ResultToDoubleCheck } from "@/logic/interfaces";

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
    const handleSelect = (value: string) => {
        const selectedResult = resultsToDoubleCheck.find((r) => r.id === value);
        if (selectedResult) {
            setJustSelected(true);
            setResult(selectedResult);
            setInputValue(selectedResult.person.registrantId?.toString() || "");
        }
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
            <DarkMode>
                <FormControl>
                    <AutoComplete
                        openOnFocus
                        onChange={handleSelect}
                        value={result?.id || ""}
                    >
                        <AutoCompleteInput
                            placeholder="Search"
                            _placeholder={{
                                color: "gray.200",
                            }}
                            borderColor="white"
                        />
                        <AutoCompleteList>
                            {resultsToDoubleCheck.map((r) => (
                                <AutoCompleteItem
                                    key={r.id}
                                    value={r.id}
                                    label={r.combinedName}
                                >
                                    {r.combinedName}
                                </AutoCompleteItem>
                            ))}
                        </AutoCompleteList>
                    </AutoComplete>
                </FormControl>
            </DarkMode>
        </Box>
    );
};

export default SelectCompetitor;
