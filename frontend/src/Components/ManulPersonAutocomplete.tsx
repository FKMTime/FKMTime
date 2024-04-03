import { DarkMode, FormControl } from "@chakra-ui/react";
import {
    AutoComplete,
    AutoCompleteInput,
    AutoCompleteItem,
    AutoCompleteList,
} from "@choc-ui/chakra-autocomplete";

import { Person } from "@/logic/interfaces";
import { getPersonNameAndRegistrantId } from "@/logic/persons.ts";

interface ManualPersonAutocompleteProps {
    onSelect: (value: string) => void;
    persons: Person[];
    autoFocus?: boolean;
    value?: string;
    disabled?: boolean;
}

const ManualPersonAutocomplete = ({
    onSelect,
    persons,
    autoFocus,
    value,
    disabled,
}: ManualPersonAutocompleteProps) => {
    return (
        <DarkMode>
            <FormControl>
                <AutoComplete openOnFocus onChange={onSelect} value={value}>
                    <AutoCompleteInput
                        autoFocus={autoFocus}
                        placeholder="Search for a person"
                        _placeholder={{
                            color: "gray.200",
                        }}
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

export default ManualPersonAutocomplete;
