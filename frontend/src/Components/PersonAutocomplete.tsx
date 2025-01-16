import { Check, ChevronsUpDown } from "lucide-react";
import { forwardRef, useCallback, useEffect, useState } from "react";

import { Person } from "@/lib/interfaces";
import { getAllPersons } from "@/lib/persons";
import { cn } from "@/lib/utils";

import { Button } from "./ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

interface PersonAutocompleteProps {
    onSelect: (value: Person | null) => void;
    autoFocus?: boolean;
    disabled?: boolean;
    withoutCardAssigned?: boolean;
    defaultValue?: string;
    personsList?: Person[];
    defaultOpen?: boolean;
}

const PersonAutocomplete = forwardRef<
    HTMLInputElement,
    PersonAutocompleteProps
>(
    (
        {
            onSelect,
            autoFocus,
            disabled,
            withoutCardAssigned,
            defaultValue,
            personsList,
            defaultOpen = false,
        },
        ref
    ) => {
        const [persons, setPersons] = useState<Person[]>(personsList || []);
        const [open, setOpen] = useState<boolean>(defaultOpen);
        const [value, setValue] = useState<string | null>(defaultValue || null);

        const handleSearch = useCallback(
            async (searchValue: string) => {
                if (personsList) {
                    setPersons(
                        personsList.filter((person) =>
                            person.name
                                .toLowerCase()
                                .includes(searchValue.toLowerCase())
                        )
                    );
                    return;
                }
                const data = await getAllPersons(
                    withoutCardAssigned,
                    searchValue
                );
                setPersons(data);
            },
            [personsList, withoutCardAssigned]
        );

        useEffect(() => {
            if (defaultValue) handleSearch("");
        }, [defaultValue, handleSearch]);

        return (
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild className="w-full">
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="justify-between"
                        disabled={disabled}
                        onClick={() => setOpen(true)}
                    >
                        {value
                            ? persons?.find((person) => person.id === value)
                                  ?.name
                            : "Select person..."}
                        <ChevronsUpDown className="opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 min-w-[var(--radix-popper-anchor-width)]">
                    <Command className="w-full" shouldFilter={false}>
                        <CommandInput
                            ref={ref}
                            id="personAutocompleteSearchInput"
                            placeholder="Search for a person..."
                            className="h-9 w-full"
                            onValueChange={(newValue) => handleSearch(newValue)}
                            autoFocus={autoFocus}
                        />
                        <CommandList className="w-full">
                            <CommandEmpty>No persons found.</CommandEmpty>
                            <CommandGroup>
                                {persons?.map((person) => (
                                    <CommandItem
                                        key={person.id}
                                        value={person.id}
                                        onSelect={(currentValue) => {
                                            setValue(
                                                currentValue === value
                                                    ? ""
                                                    : currentValue
                                            );
                                            setOpen(false);
                                            onSelect(
                                                persons.find(
                                                    (p) => p.id === currentValue
                                                ) || null
                                            );
                                        }}
                                    >
                                        {person.name}
                                        <Check
                                            className={cn(
                                                "ml-auto",
                                                value === person.id
                                                    ? "opacity-100"
                                                    : "opacity-0"
                                            )}
                                        />
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        );
    }
);

PersonAutocomplete.displayName = "PersonAutocomplete";

export default PersonAutocomplete;
