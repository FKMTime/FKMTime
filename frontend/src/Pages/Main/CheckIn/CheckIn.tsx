import { Check, Nfc } from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import EmptyState from "@/Components/shared/EmptyState";
import InlineError from "@/Components/shared/InlineError";
import ProgressBar from "@/Components/shared/ProgressBar";
import SearchInput from "@/Components/shared/SearchInput";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { useToast } from "@/hooks/useToast";
import { useUndoToast } from "@/hooks/useUndoToast";
import { Person } from "@/lib/interfaces";
import {
    checkedInCount,
    checkIn,
    getPersonInfoByCardIdWithSensitiveData,
    getPersons,
    undoCheckIn,
} from "@/lib/persons";
import { playScanSound } from "@/lib/scanSound";
import { cn, getInitials, isNewcomer } from "@/lib/utils";

import CheckInPanel from "./Components/CheckInPanel";

const SEARCH_RESULTS = 6;
const RECENT_LIMIT = 5;

type LookupSource = "scan" | "search";

const CheckIn = () => {
    const { toast } = useToast();
    const showUndo = useUndoToast();
    const scanInputRef = useRef<HTMLInputElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    // Where the selected person came from, so the cursor goes back there
    const sourceRef = useRef<LookupSource>("scan");
    const [counts, setCounts] = useState<{ done: number; total: number }>();
    const [scannedCard, setScannedCard] = useState("");
    const [scanError, setScanError] = useState("");
    const [query, setQuery] = useState("");
    // The search text the selected person was picked with
    const [pickedQuery, setPickedQuery] = useState<string | null>(null);
    const [results, setResults] = useState<Person[]>([]);
    const [selected, setSelected] = useState<Person | null>(null);
    const [checkInError, setCheckInError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [recent, setRecent] = useState<Person[]>([]);

    const fetchCounts = useCallback(async () => {
        const data = await checkedInCount();
        setCounts({
            done: data.checkedInPersonsCount,
            total: data.totalPersonsCount,
        });
    }, []);

    useEffect(() => {
        fetchCounts();
    }, [fetchCounts]);

    useEffect(() => {
        const trimmed = query.trim();
        if (trimmed.length < 2) {
            setResults([]);
            return;
        }
        let isCancelled = false;
        const timeout = setTimeout(async () => {
            const response = await getPersons(1, SEARCH_RESULTS, trimmed);
            if (!isCancelled) setResults(response.data ?? []);
        }, 250);
        return () => {
            isCancelled = true;
            clearTimeout(timeout);
        };
    }, [query]);

    const select = (person: Person | null) => {
        setSelected(person);
        setCheckInError("");
        setScanError("");
        if (!person) {
            setScannedCard("");
            setQuery("");
            setPickedQuery(null);
            const input =
                sourceRef.current === "search"
                    ? searchInputRef.current
                    : scanInputRef.current;
            setTimeout(() => input?.focus());
        }
    };

    /**
     * Enter on the same card or name again checks the person in. Not for
     * newcomers, whose ID checks need ticking, or people still without a
     * card, who get one in the panel.
     */
    const confirmSelected = () => {
        if (!selected || isLoading) return;
        if (!selected.cardId) return;
        if (isNewcomer(selected)) {
            setCheckInError("Tick the newcomer checks to check them in.");
            return;
        }
        handleCheckIn(selected.cardId);
    };

    const handleScan = async (event: FormEvent) => {
        event.preventDefault();
        const card = scannedCard.trim();
        if (!card) return;
        if (
            selected &&
            sourceRef.current === "scan" &&
            selected.cardId === card
        ) {
            confirmSelected();
            return;
        }
        const response = await getPersonInfoByCardIdWithSensitiveData(card);
        if (response.status === 200) {
            if (response.data.checkedInAt) {
                playScanSound("error");
                setScannedCard("");
                setScanError(`${response.data.name} is already checked in.`);
                return;
            }
            sourceRef.current = "scan";
            setQuery("");
            setPickedQuery(null);
            playScanSound("success");
            select(response.data);
            // Kept for Enter to check in; selected so the next scan replaces it
            scanInputRef.current?.select();
            return;
        }
        setScannedCard("");
        if (response.status === 404) {
            playScanSound("error");
            setScanError("This card is not assigned to anyone.");
        } else {
            playScanSound("error");
            setScanError("Something went wrong. Scan the card again.");
        }
    };

    const handlePick = (person: Person) => {
        if (person.checkedInAt) {
            setScanError(`${person.name} is already checked in.`);
            return;
        }
        sourceRef.current = "search";
        setScannedCard("");
        setPickedQuery(query);
        select(person);
    };

    const handleSearchSubmit = (event: FormEvent) => {
        event.preventDefault();
        if (selected && pickedQuery === query) confirmSelected();
        else if (results.length > 0) handlePick(results[0]);
    };

    const handleCheckIn = async (cardId: string) => {
        if (!selected) return;
        setIsLoading(true);
        const response = await checkIn(selected.id, cardId);
        setIsLoading(false);
        if (response.status === 200) {
            playScanSound("success");
            const person = selected;
            const assigned = !person.cardId;
            showUndo({
                title: `${person.name} checked in${assigned ? " and card assigned" : ""}`,
                onUndo: async () => {
                    const status = await undoCheckIn(person.id, assigned);
                    if (status !== 204) {
                        toast({
                            title: "Could not undo the check-in",
                            variant: "destructive",
                        });
                        return;
                    }
                    setRecent((current) =>
                        current.filter((p) => p.id !== person.id)
                    );
                    fetchCounts();
                },
            });
            setRecent((current) => [person, ...current].slice(0, RECENT_LIMIT));
            fetchCounts();
            select(null);
        } else if (response.status === 409) {
            playScanSound("error");
            setCheckInError("This card is already assigned to someone else.");
        } else {
            setCheckInError("Something went wrong. Try again.");
        }
    };

    if (!counts) return <LoadingPage />;

    const left = counts.total - counts.done;

    return (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            <div
                className={cn(
                    "flex flex-col gap-4",
                    selected && "max-lg:hidden"
                )}
            >
                <section className="flex flex-col gap-3 rounded-mobile-card border bg-card p-4 md:rounded-2xl md:p-5">
                    <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm text-muted-foreground">
                            Checked in{" "}
                            <b className="text-xl font-bold text-foreground">
                                {counts.done}
                            </b>{" "}
                            / {counts.total}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {left > 0 ? `${left} to go` : "Everyone is here"}
                        </p>
                    </div>
                    <ProgressBar
                        value={counts.done}
                        max={counts.total}
                        label="Checked in"
                    />
                </section>

                <form onSubmit={handleScan} className="flex flex-col gap-2">
                    <Label htmlFor="check-in-scan">
                        Scan the competitor&apos;s card
                    </Label>
                    <div className="relative">
                        <Nfc
                            aria-hidden
                            className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-faint"
                        />
                        <Input
                            id="check-in-scan"
                            ref={scanInputRef}
                            autoFocus
                            value={scannedCard}
                            onChange={(e) => {
                                setScannedCard(e.target.value);
                                setScanError("");
                            }}
                            placeholder="Card ID"
                            className="pl-10"
                        />
                    </div>
                    <InlineError>{scanError}</InlineError>
                </form>

                <form
                    onSubmit={handleSearchSubmit}
                    className="flex flex-col gap-2"
                >
                    <Label htmlFor="check-in-search">Or find by name</Label>
                    <SearchInput
                        ref={searchInputRef}
                        id="check-in-search"
                        enterKeyHint="go"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setScanError("");
                        }}
                        placeholder="Name or WCA ID"
                        label="Find a competitor by name"
                        className="md:max-w-none"
                    />
                    {results.length > 0 && (
                        <ul className="flex flex-col divide-y overflow-hidden rounded-mobile-card border bg-card md:rounded-xl">
                            {results.map((person) => (
                                <li key={person.id}>
                                    <button
                                        type="button"
                                        onClick={() => handlePick(person)}
                                        className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent"
                                    >
                                        <span
                                            aria-hidden
                                            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-muted-foreground"
                                        >
                                            {getInitials(person.name)}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate font-medium">
                                            {person.name}
                                            <span className="font-normal text-faint">
                                                {" "}
                                                {person.registrantId}
                                            </span>
                                        </span>
                                        <span
                                            className={cn(
                                                "text-xs font-semibold",
                                                person.checkedInAt
                                                    ? "text-success"
                                                    : "text-muted-foreground"
                                            )}
                                        >
                                            {person.checkedInAt
                                                ? "Checked in"
                                                : person.cardId
                                                  ? "Not checked in"
                                                  : "No card"}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </form>

                {recent.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <p className="text-xs font-semibold text-faint">
                            Just checked in
                        </p>
                        <ul className="flex flex-col gap-1">
                            {recent.map((person) => (
                                <li
                                    key={person.id}
                                    className="flex items-center gap-2 text-sm"
                                >
                                    <Check className="size-4 text-success" />
                                    {person.name}
                                    <span className="text-faint">
                                        {person.registrantId}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {selected ? (
                <CheckInPanel
                    key={selected.id}
                    person={selected}
                    error={checkInError}
                    isLoading={isLoading}
                    onCheckIn={handleCheckIn}
                    onCancel={() => select(null)}
                />
            ) : (
                <EmptyState className="hidden lg:flex">
                    Scan a card or search for a competitor.
                </EmptyState>
            )}
        </div>
    );
};

export default CheckIn;
