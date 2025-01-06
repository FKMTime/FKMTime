import { FormControl } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";

import { Person } from "@/lib/interfaces";
import {
    getAllPersons,
    getPersonNameAndRegistrantId,
} from "@/lib/persons";

import Autocomplete from "./Autocomplete";

interface PersonAutocompleteProps {
    onSelect: (value: Person) => void;
    autoFocus?: boolean;
    value?: Person | null;
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

    const fetchPersons = useCallback(async () => {
        const data = await getAllPersons(withoutCardAssigned);
        setPersons(data);
    }, [withoutCardAssigned]);

    useEffect(() => {
        fetchPersons();
    }, [fetchPersons, withoutCardAssigned]);

    return (
        <FormControl>
            <Autocomplete
                options={persons}
                selectedValue={value || null}
                onOptionSelect={(option) => onSelect(option)}
                getOptionLabel={getPersonNameAndRegistrantId}
                placeholder="Search for a person"
                disabled={disabled}
                autoFocus={autoFocus}
            />
        </FormControl>
    );
};

export default PersonAutocomplete;
