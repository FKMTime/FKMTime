import { CircleCheck, Nfc } from "lucide-react";
import {
    FormEvent,
    KeyboardEvent,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

import EmptyState from "@/Components/shared/EmptyState";
import InlineError from "@/Components/shared/InlineError";
import SearchInput from "@/Components/shared/SearchInput";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { useToast } from "@/hooks/useToast";
import { Person } from "@/lib/interfaces";
import { assignCard, getAllPersons } from "@/lib/persons";
import { playScanSound } from "@/lib/scanSound";
import { cn, getInitials, regionNameByIso2 } from "@/lib/utils";
import PersonsTabs from "@/Pages/Main/Persons/Components/PersonsTabs";

/** Pick a person without a card, scan a card, move on to the next one */
const AssignCards = () => {
    const { toast } = useToast();
    const cardInputRef = useRef<HTMLInputElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [search, setSearch] = useState("");
    const [persons, setPersons] = useState<Person[] | null>(null);
    const [selected, setSelected] = useState<Person | null>(null);
    const [cardId, setCardId] = useState("");
    const [error, setError] = useState("");
    const [assignedCount, setAssignedCount] = useState(0);
    // Row the arrow keys are on; Enter in the search picks it
    const [highlighted, setHighlighted] = useState(0);
    const listRef = useRef<HTMLUListElement>(null);

    const fetchPersons = useCallback(async () => {
        const data: Person[] = await getAllPersons(true, search || undefined);
        setPersons(data);
        return data;
    }, [search]);

    useEffect(() => {
        fetchPersons();
    }, [fetchPersons]);

    useEffect(() => setHighlighted(0), [persons]);

    useEffect(() => {
        listRef.current
            ?.querySelector('[aria-selected="true"]')
            ?.scrollIntoView({ block: "nearest" });
    }, [highlighted]);

    const select = (person: Person | null) => {
        setSelected(person);
        setCardId("");
        setError("");
        if (person) setTimeout(() => cardInputRef.current?.focus());
    };

    const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        const count = persons?.length ?? 0;
        if (!count) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const step = event.key === "ArrowDown" ? 1 : count - 1;
            setHighlighted((h) => (h + step) % count);
        } else if (event.key === "Enter") {
            event.preventDefault();
            select(persons![Math.min(highlighted, count - 1)]);
        }
    };

    const handleAssign = async (event: FormEvent) => {
        event.preventDefault();
        if (!selected || !cardId.trim()) return;
        const status = await assignCard(selected.id, cardId.trim());
        if (status === 200) {
            playScanSound("success");
            toast({
                title: `Card assigned to ${selected.name}`,
                variant: "success",
            });
            setAssignedCount((count) => count + 1);
            // Back to the search, ready for the next person
            select(null);
            if (search) setSearch("");
            else fetchPersons();
            // After the re-render: on phones the list is hidden until then
            setTimeout(() => searchInputRef.current?.focus());
        } else if (status === 409) {
            playScanSound("error");
            setError("This card is already assigned to someone else.");
            cardInputRef.current?.select();
        } else {
            playScanSound("error");
            setError("Something went wrong. Try again.");
        }
    };

    const isDone = persons !== null && persons.length === 0 && !search;

    return (
        <div className="flex flex-col gap-4">
            <PersonsTabs value="cards" refreshKey={assignedCount} />

            {isDone ? (
                <EmptyState icon={<CircleCheck />}>
                    Everyone has a card.
                </EmptyState>
            ) : (
                <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
                    <div
                        className={cn(
                            "flex flex-col gap-3",
                            selected && "max-lg:hidden"
                        )}
                    >
                        <SearchInput
                            ref={searchInputRef}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
                            label="Search persons without a card"
                            role="combobox"
                            aria-expanded={!!persons?.length}
                            aria-controls="assign-cards-persons"
                            aria-activedescendant={
                                persons?.[highlighted]
                                    ? `assign-cards-${persons[highlighted].id}`
                                    : undefined
                            }
                        />
                        <ul
                            ref={listRef}
                            id="assign-cards-persons"
                            role="listbox"
                            aria-label="Persons without a card"
                            className="flex flex-col divide-y overflow-hidden rounded-mobile-card border bg-card md:rounded-2xl"
                        >
                            {(persons ?? []).map((person, index) => (
                                <li key={person.id} role="presentation">
                                    <button
                                        type="button"
                                        id={`assign-cards-${person.id}`}
                                        role="option"
                                        tabIndex={-1}
                                        aria-selected={index === highlighted}
                                        onClick={() => select(person)}
                                        onMouseEnter={() =>
                                            setHighlighted(index)
                                        }
                                        aria-current={
                                            person.id === selected?.id ||
                                            undefined
                                        }
                                        className={cn(
                                            "flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left",
                                            index === highlighted &&
                                                "bg-accent",
                                            person.id === selected?.id &&
                                                "bg-primary-soft"
                                        )}
                                    >
                                        <span
                                            aria-hidden
                                            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-muted-foreground"
                                        >
                                            {getInitials(person.name)}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate font-medium">
                                            {person.name}
                                        </span>
                                        <span className="text-sm text-faint">
                                            {person.registrantId}
                                        </span>
                                    </button>
                                </li>
                            ))}
                            {persons?.length === 0 && (
                                <li
                                    role="presentation"
                                    className="p-6 text-center text-sm text-muted-foreground"
                                >
                                    Nobody matches “{search}”.
                                </li>
                            )}
                        </ul>
                    </div>

                    {selected ? (
                        <form
                            onSubmit={handleAssign}
                            className="flex flex-col gap-4 rounded-mobile-card border bg-card p-4 md:rounded-2xl md:p-[22px] lg:sticky lg:top-[88px]"
                        >
                            <div>
                                <h2 className="text-lg font-bold">
                                    {selected.name}
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    {[
                                        selected.registrantId &&
                                            `ID ${selected.registrantId}`,
                                        selected.countryIso2 &&
                                            regionNameByIso2(
                                                selected.countryIso2
                                            ),
                                    ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Nfc
                                        aria-hidden
                                        className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-faint"
                                    />
                                    <Input
                                        ref={cardInputRef}
                                        value={cardId}
                                        onChange={(e) => {
                                            setCardId(e.target.value);
                                            setError("");
                                        }}
                                        placeholder="Card ID"
                                        aria-label="Card ID"
                                        className="pl-10"
                                    />
                                </div>
                                <Button type="submit" disabled={!cardId.trim()}>
                                    Assign
                                </Button>
                            </div>
                            <InlineError>{error}</InlineError>
                            <p className="text-[13px] text-muted-foreground">
                                Tap the card on the reader. Then search for the
                                next person.
                            </p>
                            <Button
                                type="button"
                                variant="outline"
                                className="lg:hidden"
                                onClick={() => select(null)}
                            >
                                Back to the list
                            </Button>
                        </form>
                    ) : (
                        <EmptyState className="hidden lg:flex">
                            Pick a person to assign a card.
                        </EmptyState>
                    )}
                </div>
            )}
        </div>
    );
};

export default AssignCards;
