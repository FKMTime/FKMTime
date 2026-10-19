import { Search } from "lucide-react";
import { KeyboardEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
    Popover,
    PopoverAnchor,
    PopoverContent,
} from "@/Components/ui/popover";
import { Person } from "@/lib/interfaces";
import { getPersons } from "@/lib/persons";
import { cn } from "@/lib/utils";

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 8;
const DEBOUNCE_MS = 250;

/** Header search: find a competitor by name or WCA ID and open their results */
const CompetitorSearch = () => {
    const navigate = useNavigate();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<Person[]>([]);
    // Closed after blur, Escape or picking a result; typing reopens it
    const [isDismissed, setIsDismissed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [highlighted, setHighlighted] = useState(0);
    const trimmed = query.trim();
    const isOpen = !isDismissed && trimmed.length >= MIN_QUERY_LENGTH;

    useEffect(() => {
        if (trimmed.length < MIN_QUERY_LENGTH) {
            setResults([]);
            setIsLoading(false);
            return;
        }
        let isCancelled = false;
        setIsLoading(true);
        const timeout = setTimeout(async () => {
            const response = await getPersons(1, MAX_RESULTS, trimmed);
            if (isCancelled) return;
            setResults(response.data ?? []);
            setHighlighted(0);
            setIsLoading(false);
        }, DEBOUNCE_MS);
        return () => {
            isCancelled = true;
            clearTimeout(timeout);
        };
    }, [trimmed]);

    const open = (person: Person) => {
        setQuery("");
        setIsDismissed(true);
        navigate(`/persons/${person.id}/results`);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Escape") {
            setQuery("");
            event.currentTarget.blur();
            return;
        }
        if (!results.length) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const step = event.key === "ArrowDown" ? 1 : results.length - 1;
            setHighlighted((h) => (h + step) % results.length);
        } else if (event.key === "Enter") {
            event.preventDefault();
            open(results[highlighted] ?? results[0]);
        }
    };

    return (
        <Popover open={isOpen}>
            <PopoverAnchor asChild>
                <label className="flex h-[38px] min-w-11 flex-[0_1_260px] cursor-text items-center gap-2 overflow-hidden rounded-lg border bg-card px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                    <Search className="size-[18px] shrink-0 text-faint" />
                    <input
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setIsDismissed(false);
                        }}
                        onBlur={() => setIsDismissed(true)}
                        onKeyDown={handleKeyDown}
                        placeholder="Find competitor or WCA ID"
                        aria-label="Find competitor or WCA ID"
                        role="combobox"
                        aria-expanded={isOpen}
                        aria-controls="competitor-search-results"
                        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
                    />
                </label>
            </PopoverAnchor>
            <PopoverContent
                align="end"
                className="w-[360px] p-1.5"
                onOpenAutoFocus={(e) => e.preventDefault()}
                // Keep the input focused while picking with the mouse
                onMouseDown={(e) => e.preventDefault()}
            >
                <ul
                    id="competitor-search-results"
                    role="listbox"
                    className="flex flex-col gap-0.5"
                >
                    {results.map((person, index) => (
                        <li
                            key={person.id}
                            role="option"
                            aria-selected={index === highlighted}
                            onClick={() => open(person)}
                            onMouseEnter={() => setHighlighted(index)}
                            className={cn(
                                "flex cursor-pointer flex-col gap-0.5 rounded-lg px-3 py-2",
                                index === highlighted && "bg-accent"
                            )}
                        >
                            <span className="truncate text-sm font-semibold">
                                {person.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {[
                                    person.registrantId &&
                                        `ID ${person.registrantId}`,
                                    person.wcaId ?? "Newcomer",
                                ]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </span>
                        </li>
                    ))}
                </ul>
                {!results.length && (
                    <p className="px-3 py-5 text-center text-[13px] text-muted-foreground">
                        {isLoading ? "Searching…" : "No competitors found"}
                    </p>
                )}
            </PopoverContent>
        </Popover>
    );
};

export default CompetitorSearch;
