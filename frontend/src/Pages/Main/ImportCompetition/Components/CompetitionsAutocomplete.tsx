import { FormControl } from "@chakra-ui/react";

import DynamicAutocomplete from "@/Components/DynamicAutocomplete";
import { searchCompetitions } from "@/logic/competition.ts";
import { WCACompetition } from "@/logic/interfaces";

interface CompetitionsAutocompleteProps {
    onSelect: (competition: WCACompetition | null) => void;
}

const CompetitionsAutocomplete = ({
    onSelect,
}: CompetitionsAutocompleteProps) => {
    const handleSearch = async (searchValue: string) => {
        const data = await searchCompetitions(searchValue);
        return data;
    };

    return (
        <FormControl>
            <DynamicAutocomplete
                fetchOptions={handleSearch}
                onChange={onSelect}
                getOptionLabel={(option) => option.name}
                placeholder="Search for a competition"
            />
        </FormControl>
    );
};

export default CompetitionsAutocomplete;
