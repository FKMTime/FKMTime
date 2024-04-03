import { DarkMode, FormControl } from "@chakra-ui/react";
import {
    AutoComplete,
    AutoCompleteInput,
    AutoCompleteItem,
    AutoCompleteList,
} from "@choc-ui/chakra-autocomplete";

import { Person } from "@/logic/interfaces";

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

export default ManualPersonAutocomplete;
