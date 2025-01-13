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
import { searchCompetitions } from "@/lib/competition";
import { WCACompetition } from "@/lib/interfaces";
import { cn } from "@/lib/utils";

interface CompetitionsAutocompleteProps {
    onSelect: (competition: WCACompetition | null) => void;
}

const CompetitionsAutocomplete = ({
    onSelect,
}: CompetitionsAutocompleteProps) => {
    const [competitions, setCompetitions] = useState<WCACompetition[]>([]);
    const [open, setOpen] = useState<boolean>(false);
    const [value, setValue] = useState<string | null>(null);

    const handleSearch = async (searchValue: string) => {
        const data = await searchCompetitions(searchValue);
        setCompetitions(data);
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
                    Select a competition
                    <ChevronsUpDown className="opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0 min-w-[var(--radix-popper-anchor-width)]">
                <Command className="w-full">
                    <CommandInput
                        placeholder="Search for a competition..."
                        className="h-9 w-full"
                        onValueChange={(newValue) => handleSearch(newValue)}
                    />
                    <CommandList className="w-full">
                        <CommandEmpty>No competitions found.</CommandEmpty>
                        <CommandGroup>
                            {competitions?.map((competition) => (
                                <CommandItem
                                    key={competition.id}
                                    value={competition.id}
                                    onSelect={(currentValue) => {
                                        setValue(
                                            currentValue === value
                                                ? ""
                                                : currentValue
                                        );
                                        setOpen(false);
                                        onSelect(
                                            competitions.find(
                                                (c) => c.id === currentValue
                                            ) || null
                                        );
                                    }}
                                >
                                    {competition.name}
                                    <Check
                                        className={cn(
                                            "ml-auto",
                                            value === competition.id
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

export default CompetitionsAutocomplete;
