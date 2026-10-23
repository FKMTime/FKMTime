import { Search } from "lucide-react";
import { KeyboardEvent, useEffect, useState } from "react";

import {
    Popover,
    PopoverAnchor,
    PopoverContent,
} from "@/Components/ui/popover";
import { searchCompetitions } from "@/lib/competition";
import { WCACompetition } from "@/lib/interfaces";
import { cn } from "@/lib/utils";

import { competitionMeta } from "./competitionMeta";

const DEBOUNCE_MS = 250;
const MAX_RESULTS = 8;

interface CompetitionSearchProps {
    onSelect: (competition: WCACompetition) => void;
}

/** WCA admins only: search every WCA competition and add one to the list */
const CompetitionSearch = ({ onSelect }: CompetitionSearchProps) => {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<WCACompetition[]>([]);
    // Closed after blur, Escape or picking a result; typing reopens it
    const [isDismissed, setIsDismissed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [highlighted, setHighlighted] = useState(0);
    const trimmed = query.trim();
    const isOpen = !isDismissed && trimmed.length > 0;

    useEffect(() => {
        if (!trimmed) {
            setResults([]);
            setIsLoading(false);
            return;
        }
        let isCancelled = false;
        setIsLoading(true);
        const timeout = setTimeout(async () => {
            const data: WCACompetition[] = await searchCompetitions(trimmed);
            if (isCancelled) return;
            setResults(data.slice(0, MAX_RESULTS));
            setHighlighted(0);
            setIsLoading(false);
        }, DEBOUNCE_MS);
        return () => {
            isCancelled = true;
            clearTimeout(timeout);
        };
    }, [trimmed]);

    const pick = (competition: WCACompetition) => {
        setQuery("");
        onSelect(competition);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Escape") {
            setIsDismissed(true);
            return;
        }
        if (!results.length) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const step = event.key === "ArrowDown" ? 1 : results.length - 1;
            setHighlighted((h) => (h + step) % results.length);
        } else if (event.key === "Enter") {
            event.preventDefault();
            pick(results[highlighted] ?? results[0]);
        }
    };

    return (
        <Popover open={isOpen}>
            <PopoverAnchor asChild>
                <label className="flex h-11 cursor-text items-center gap-2 rounded-[10px] border bg-card px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                    <Search className="size-5 shrink-0 text-faint" />
                    <input
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setIsDismissed(false);
                        }}
                        onBlur={() => setIsDismissed(true)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search all WCA competitions"
                        aria-label="Search all WCA competitions"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        role="combobox"
                        aria-expanded={isOpen}
                        aria-controls="competition-search-results"
                        className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
                    />
                </label>
            </PopoverAnchor>
            <PopoverContent
                align="start"
                className="w-[var(--radix-popper-anchor-width)] p-1.5"
                onOpenAutoFocus={(e) => e.preventDefault()}
                // Keep the input focused while picking with the mouse
                onMouseDown={(e) => e.preventDefault()}
            >
                <ul
                    id="competition-search-results"
                    role="listbox"
                    className="flex flex-col gap-0.5"
                >
                    {results.map((competition, index) => (
                        <li
                            key={competition.id}
                            role="option"
                            aria-selected={index === highlighted}
                            onClick={() => pick(competition)}
                            onMouseEnter={() => setHighlighted(index)}
                            className={cn(
                                "flex cursor-pointer flex-col gap-0.5 rounded-lg px-2.5 py-2",
                                index === highlighted && "bg-accent"
                            )}
                        >
                            <span className="truncate text-sm font-semibold">
                                {competition.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {competitionMeta(competition)}
                            </span>
                        </li>
                    ))}
                </ul>
                {!results.length && (
                    <p className="px-2.5 py-3 text-sm text-muted-foreground">
                        {isLoading ? "Searching…" : "No competitions found"}
                    </p>
                )}
            </PopoverContent>
        </Popover>
    );
};

export default CompetitionSearch;
