import { DarkMode, FormControl } from "@chakra-ui/react";
import {
    AutoComplete,
    AutoCompleteInput,
    AutoCompleteItem,
    AutoCompleteList,
} from "@choc-ui/chakra-autocomplete";
import { ChangeEvent, useState } from "react";

import { Person } from "@/logic/interfaces";
import { getPersonNameAndRegistrantId, getPersons } from "@/logic/persons.ts";

interface PersonAutocompleteProps {
    onSelect: (value: string) => void;
    autoFocus?: boolean;
    value?: string;
    disabled?: boolean;
    withoutCardAssigned?: boolean;
}

const PersonAutocomplete = ({
    onSelect,
    autoFocus,
    value,
    disabled,
    withoutCardAssigned,
}: PersonAutocompleteProps) => {
    const [persons, setPersons] = useState<Person[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const handleSearch = async (searchValue: string) => {
        setIsLoading(true);
        const response = await getPersons(
            1,
            10,
            searchValue,
            undefined,
            withoutCardAssigned
        );
        if (response.data.length === 0) {
            setIsLoading(false);
            return;
        }
        setPersons(response.data);
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
                        autoFocus={autoFocus}
                        autoComplete="off"
                        placeholder="Search for a person"
                        _placeholder={{
                            color: "gray.200",
                        }}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            handleSearch(e.target.value)
                        }
                        disabled={disabled}
                        borderColor="white"
                        id="searchInput"
                    />
                    <AutoCompleteList>
                        {persons.map((person) => (
                            <AutoCompleteItem
                                key={person.id}
                                value={person.id}
                                label={getPersonNameAndRegistrantId(person)}
                            >
                                {getPersonNameAndRegistrantId(person)}
                            </AutoCompleteItem>
                        ))}
                    </AutoCompleteList>
                </AutoComplete>
            </FormControl>
        </DarkMode>
    );
};

export default PersonAutocomplete;
