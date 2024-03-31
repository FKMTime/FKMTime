import { DarkMode, FormControl } from "@chakra-ui/react";
import {
    AutoComplete,
    AutoCompleteInput,
    AutoCompleteItem,
    AutoCompleteList,
} from "@choc-ui/chakra-autocomplete";
import { ChangeEvent, useState } from "react";

import { searchCompetitions } from "@/logic/competition";
import { WCACompetition } from "@/logic/interfaces";

interface CompetitionsAutocompleteProps {
    value: string;
    onSelect: (value: string) => void;
}

const CompetitionsAutocomplete = ({
    value,
    onSelect,
}: CompetitionsAutocompleteProps) => {
    const [competitions, setCompetitions] = useState<WCACompetition[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const handleSearch = async (searchValue: string) => {
        setIsLoading(true);
        const data = await searchCompetitions(searchValue);
        if (data.length === 0) {
            setIsLoading(false);
            return;
        }
        setCompetitions(data);
        setIsLoading(false);
    };

    return (
        <DarkMode>
            <FormControl>
                <AutoComplete
                    openOnFocus
                    onChange={onSelect}
                    value={value}
                    isLoading={isLoading}
                >
                    <AutoCompleteInput
                        autoFocus
                        autoComplete="off"
                        placeholder="Search for a competition"
                        _placeholder={{
                            color: "gray.200",
                        }}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            handleSearch(e.target.value)
                        }
                        borderColor="white"
                    />
                    <AutoCompleteList loadingState={isLoading}>
                        {competitions.map((competition) => (
                            <AutoCompleteItem
                                key={competition.id}
                                value={competition.id}
                                label={competition.name}
                            >
                                {competition.name}
                            </AutoCompleteItem>
                        ))}
                    </AutoCompleteList>
                </AutoComplete>
            </FormControl>
        </DarkMode>
    );
};

export default CompetitionsAutocomplete;
