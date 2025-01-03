import { useCallback, useEffect, useState } from "react";

import { Person } from "@/logic/interfaces";
import {
    getAllPersons,
    getPersonNameAndRegistrantId,
} from "@/logic/persons.ts";

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
        <Autocomplete
            options={persons}
            selectedValue={value || null}
            onOptionSelect={(option) => onSelect(option)}
            getOptionLabel={getPersonNameAndRegistrantId}
            placeholder="Search for a person"
            disabled={disabled}
            autoFocus={autoFocus}
        />
    );
};

export default PersonAutocomplete;
