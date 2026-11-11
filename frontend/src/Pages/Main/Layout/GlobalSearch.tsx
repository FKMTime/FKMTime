import { useAtomValue } from "jotai";
import { Search } from "lucide-react";
import { KeyboardEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
    Popover,
    PopoverAnchor,
    PopoverContent,
} from "@/Components/ui/popover";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useNavItems } from "@/hooks/useNavItems";
import { competitionAtom } from "@/lib/atoms";
import { devicesQuery } from "@/lib/devices";
import {
    deviceToItem,
    getGroupItems,
    getPageItems,
    getRoundItems,
    incidentToItem,
    personToItem,
    SearchItem,
    searchItems,
} from "@/lib/globalSearch";
import { unresolvedIncidentsQuery } from "@/lib/incidents";
import { Person } from "@/lib/interfaces";
import { personsPageQuery } from "@/lib/persons";
import { cn } from "@/lib/utils";

const MIN_QUERY_LENGTH = 2;
const MAX_PERSONS = 5;
const DEBOUNCE_MS = 250;

/**
 * Header search across everything the user can open: pages and their tabs,
 * competitors, rounds, groups, open incidents and devices.
 */
const GlobalSearch = () => {
    const navigate = useNavigate();
    const competition = useAtomValue(competitionAtom);
    const { items: navItems } = useNavItems();
    const [query, setQuery] = useState("");
    // Closed after blur, Escape or picking a result; typing reopens it
    const [isDismissed, setIsDismissed] = useState(false);
    const [highlighted, setHighlighted] = useState(0);
    const trimmed = query.trim();
    const [highlightedQuery, setHighlightedQuery] = useState(trimmed);
    if (trimmed !== highlightedQuery) {
        setHighlightedQuery(trimmed);
        setHighlighted(0);
    }
    const isOpen = !isDismissed && trimmed.length >= MIN_QUERY_LENGTH;

    const useDevices = !!competition?.useFkmTimeDevices;
    const canSeeDevices =
        useDevices && navItems.some((item) => item.id === "setup");
    const canSeeIncidents =
        useDevices && navItems.some((item) => item.id === "incidents");

    const staticItems = useMemo(
        () =>
            competition
                ? [
                      ...getPageItems(navItems, {
                          useFkmTimeDevices: useDevices,
                      }),
                      ...getRoundItems(competition.wcif, navItems),
                      ...getGroupItems(competition.wcif, navItems),
                  ]
                : [],
        [competition, navItems, useDevices]
    );

    // Loaded on the first search, and only when the user can open them
    const { data: devices } = useLiveQuery(devicesQuery, {
        enabled: isOpen && canSeeDevices,
    });
    const { data: incidents } = useLiveQuery(unresolvedIncidentsQuery, {
        enabled: isOpen && canSeeIncidents,
    });

    // People are searched once typing pauses
    const search = useDebouncedValue(trimmed, DEBOUNCE_MS);
    const isSearchLongEnough = trimmed.length >= MIN_QUERY_LENGTH;
    const { data: personsPage, isFetching } = useLiveQuery(
        personsPageQuery({ page: 1, pageSize: MAX_PERSONS, search }),
        {
            keepPreviousData: true,
            enabled: search.length >= MIN_QUERY_LENGTH,
        }
    );
    const persons: Person[] = useMemo(
        () => (isSearchLongEnough ? personsPage?.data ?? [] : []),
        [isSearchLongEnough, personsPage]
    );
    const isLoading = isSearchLongEnough && (search !== trimmed || isFetching);

    const sections = useMemo(
        () =>
            searchItems(
                [
                    ...staticItems,
                    ...(devices ?? []).map(deviceToItem),
                    ...(incidents ?? []).map(incidentToItem),
                ],
                trimmed,
                persons.map(personToItem)
            ),
        [staticItems, devices, incidents, persons, trimmed]
    );
    const flat = sections.flatMap((group) => group.items);

    const open = (item: SearchItem) => {
        setQuery("");
        setIsDismissed(true);
        navigate(item.to);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Escape") {
            setQuery("");
            event.currentTarget.blur();
            return;
        }
        if (!flat.length) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const step = event.key === "ArrowDown" ? 1 : flat.length - 1;
            setHighlighted((h) => (h + step) % flat.length);
        } else if (event.key === "Enter") {
            event.preventDefault();
            open(flat[highlighted] ?? flat[0]);
        }
    };

    return (
        <Popover open={isOpen}>
            <PopoverAnchor asChild>
                <label className="flex h-[38px] min-w-11 flex-[0_1_300px] cursor-text items-center gap-2 overflow-hidden rounded-lg border bg-card px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                    <Search className="size-[18px] shrink-0 text-faint" />
                    <input
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setIsDismissed(false);
                        }}
                        onBlur={() => setIsDismissed(true)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search competitors, rounds, pages…"
                        aria-label="Search"
                        role="combobox"
                        aria-expanded={isOpen}
                        aria-controls="global-search-results"
                        aria-activedescendant={
                            flat[highlighted]
                                ? `global-search-${flat[highlighted].id}`
                                : undefined
                        }
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        className="min-w-0 flex-1 bg-transparent text-sm outline-hidden placeholder:text-faint"
                    />
                </label>
            </PopoverAnchor>
            <PopoverContent
                align="end"
                className="max-h-[min(70dvh,560px)] w-[400px] overflow-y-auto p-1.5"
                onOpenAutoFocus={(e) => e.preventDefault()}
                // Keep the input focused while picking with the mouse
                onMouseDown={(e) => e.preventDefault()}
            >
                <div
                    id="global-search-results"
                    role="listbox"
                    aria-label="Search results"
                    className="flex flex-col gap-1"
                >
                    {sections.map(({ section, items }) => (
                        <div
                            key={section}
                            role="group"
                            aria-labelledby={`global-search-${section}`}
                            className="flex flex-col gap-0.5"
                        >
                            <span
                                id={`global-search-${section}`}
                                className="px-3 pb-0.5 pt-1.5 text-xs font-semibold text-faint"
                            >
                                {section}
                            </span>
                            {items.map((item) => {
                                const index = flat.indexOf(item);
                                return (
                                    <div
                                        key={item.id}
                                        id={`global-search-${item.id}`}
                                        role="option"
                                        aria-selected={index === highlighted}
                                        onClick={() => open(item)}
                                        onMouseEnter={() =>
                                            setHighlighted(index)
                                        }
                                        className={cn(
                                            "flex cursor-pointer flex-col gap-0.5 rounded-lg px-3 py-2",
                                            index === highlighted && "bg-accent"
                                        )}
                                    >
                                        <span className="truncate text-sm font-semibold">
                                            {item.label}
                                        </span>
                                        {item.description && (
                                            <span className="truncate text-xs text-muted-foreground">
                                                {item.description}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
                {!flat.length && (
                    <p className="px-3 py-5 text-center text-[13px] text-muted-foreground">
                        {isLoading ? "Searching…" : "Nothing found"}
                    </p>
                )}
            </PopoverContent>
        </Popover>
    );
};

export default GlobalSearch;
