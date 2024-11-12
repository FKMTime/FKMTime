import { DarkMode, FormControl } from "@chakra-ui/react";
import {
    AutoComplete,
    AutoCompleteInput,
    AutoCompleteItem,
    AutoCompleteList,
} from "@choc-ui/chakra-autocomplete";
import { ChangeEvent, useState } from "react";

import { WCAPerson } from "@/logic/interfaces";
import { getPersonsFromWCA } from "@/logic/persons";

interface WCAPersonsAutocompleteProps {
    value: string;
    onSelect: (person: WCAPerson) => void;
}

const WCAPersonsAutocomplete = ({
    value,
    onSelect,
}: WCAPersonsAutocompleteProps) => {
    const [persons, setPersons] = useState<WCAPerson[]>([]);

    const handleSearch = async (searchValue: string) => {
        const data = await getPersonsFromWCA(searchValue);
        setPersons(data);
    };

    const handleSelect = (id: string) => {
        const person = persons.find((p) => p.wcaId === id);
        if (person) onSelect(person);
    };

    return (
        <DarkMode>
            <FormControl>
                <AutoComplete openOnFocus onChange={handleSelect} value={value}>
                    <AutoCompleteInput
                        autoFocus
                        placeholder="Search for a person"
                        _placeholder={{
                            color: "gray.200",
                        }}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            handleSearch(e.target.value)
                        }
                        borderColor="white"
                    />
                    <AutoCompleteList>
                        {persons.map((person) => (
                            <AutoCompleteItem
                                key={person.wcaId}
                                value={person.wcaId}
                                label={person.combinedName}
                            >
                                {person.combinedName}
                            </AutoCompleteItem>
                        ))}
                    </AutoCompleteList>
                </AutoComplete>
            </FormControl>
        </DarkMode>
    );
};

export default WCAPersonsAutocomplete;
