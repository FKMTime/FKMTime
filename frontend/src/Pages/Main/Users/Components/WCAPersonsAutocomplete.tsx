import { FormControl } from "@chakra-ui/react";

import DynamicAutocomplete from "@/Components/DynamicAutocomplete";
import { WCAPerson } from "@/logic/interfaces";
import { getPersonsFromWCA } from "@/logic/persons";

interface WCAPersonsAutocompleteProps {
    onSelect: (person: WCAPerson | null) => void;
}

const WCAPersonsAutocomplete = ({ onSelect }: WCAPersonsAutocompleteProps) => {
    const handleSearch = async (searchValue: string) => {
        const data = await getPersonsFromWCA(searchValue);
        return data;
    };

    return (
        <FormControl>
            <DynamicAutocomplete
                fetchOptions={handleSearch}
                onChange={onSelect}
                getOptionLabel={(option) => option.combinedName}
                placeholder="Search for a person"
            />
        </FormControl>
    );
};

export default WCAPersonsAutocomplete;
