import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";

import { Button } from "@/Components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/Components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/Components/ui/popover";
import { WCAPerson } from "@/lib/interfaces";
import { getPersonsFromWCA } from "@/lib/persons";
import { cn } from "@/lib/utils";

interface WCAPersonsAutocompleteProps {
    onSelect: (person: WCAPerson | null) => void;
}

const WCAPersonsAutocomplete = ({ onSelect }: WCAPersonsAutocompleteProps) => {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState("");
    const [persons, setPersons] = useState<WCAPerson[]>([]);

    const handleSearch = async (searchValue: string) => {
        const data = await getPersonsFromWCA(searchValue);
        setPersons(data);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild className="w-full">
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="justify-between"
                >
                    {value
                        ? persons?.find((person) => person.wcaId === value)
                              ?.combinedName
                        : "Select person..."}
                    <ChevronsUpDown className="opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0 min-w-[var(--radix-popper-anchor-width)]">
                <Command className="w-full">
                    <CommandInput
                        placeholder="Search for a person..."
                        className="h-9 w-full"
                        onValueChange={handleSearch}
                    />
                    <CommandList className="w-full">
                        <CommandEmpty>No persons found.</CommandEmpty>
                        <CommandGroup>
                            {persons &&
                                persons?.map((person) => (
                                    <CommandItem
                                        key={person.wcaId}
                                        value={person.wcaId}
                                        onSelect={(currentValue) => {
                                            setValue(
                                                currentValue === value
                                                    ? ""
                                                    : currentValue
                                            );
                                            setOpen(false);
                                            onSelect(
                                                persons.find(
                                                    (p) =>
                                                        p.wcaId === currentValue
                                                ) || null
                                            );
                                        }}
                                    >
                                        {person.combinedName}
                                        <Check
                                            className={cn(
                                                "ml-auto",
                                                value === person.wcaId
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
};

export default WCAPersonsAutocomplete;
