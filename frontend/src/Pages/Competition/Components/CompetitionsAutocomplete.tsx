import { DarkMode, FormControl } from "@chakra-ui/react";
import {
    AutoComplete,
    AutoCompleteInput,
    AutoCompleteItem,
    AutoCompleteList,
} from "@choc-ui/chakra-autocomplete";
import { ChangeEvent, useState } from "react";

import { searchCompetitions } from "@/logic/competition.ts";
import { WCACompetition } from "@/logic/interfaces";

interface CompetitionsAutocompleteProps {
    value: string;
    onSelect: (value: string) => void;
}

const CompetitionsAutocomplete = ({
    value,
    onSelect,
}: CompetitionsAutocompleteProps) => {
    const [competitions, setCompetition] = useState<WCACompetition[]>([]);

    const handleSearch = async (searchValue: string) => {
        const data = await searchCompetitions(searchValue);
        setCompetition(data);
    };

    return (
        <DarkMode>
            <FormControl>
                <AutoComplete openOnFocus onChange={onSelect} value={value}>
                    <AutoCompleteInput
                        autoFocus
                        placeholder="Search for a competition"
                        _placeholder={{
                            color: "gray.200",
                        }}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            handleSearch(e.target.value)
                        }
                        borderColor="white"
                    />
                    <AutoCompleteList>
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
