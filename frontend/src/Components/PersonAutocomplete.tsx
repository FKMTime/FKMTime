import { DarkMode, FormControl } from "@chakra-ui/react";
import {
    AutoComplete,
    AutoCompleteInput,
    AutoCompleteItem,
    AutoCompleteList,
} from "@choc-ui/chakra-autocomplete";

import { Person } from "@/logic/interfaces";

interface PersonAutocompleteProps {
    onSelect: (value: string) => void;
    persons: Person[];
    autoFocus?: boolean;
    value?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ref?: any;
    disabled?: boolean;
}

const PersonAutocomplete = ({
    onSelect,
    persons,
    autoFocus,
    value,
    ref,
    disabled,
}: PersonAutocompleteProps) => {
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
                        ref={ref}
                        borderColor="white"
                    />
                    <AutoCompleteList>
                        {persons.map((person) => (
                            <AutoCompleteItem
                                key={person.id}
                                value={person.id}
                                label={`${person.name} ${person.registrantId ? `(${person.registrantId})` : ""}`}
                            >
                                {person.name}{" "}
                                {person.registrantId
                                    ? `(${person.registrantId})`
                                    : ""}
                            </AutoCompleteItem>
                        ))}
                    </AutoCompleteList>
                </AutoComplete>
            </FormControl>
        </DarkMode>
    );
};

export default PersonAutocomplete;
