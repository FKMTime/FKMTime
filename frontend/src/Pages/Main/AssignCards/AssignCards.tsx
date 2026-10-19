import { CircleCheck, Nfc } from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import EmptyState from "@/Components/shared/EmptyState";
import InlineError from "@/Components/shared/InlineError";
import SearchInput from "@/Components/shared/SearchInput";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { useToast } from "@/hooks/useToast";
import { Person } from "@/lib/interfaces";
import { assignCard, getAllPersons } from "@/lib/persons";
import { cn, getInitials, regionNameByIso2 } from "@/lib/utils";
import PersonsTabs from "@/Pages/Main/Persons/Components/PersonsTabs";

/** Pick a person without a card, scan a card, move on to the next one */
const AssignCards = () => {
    const { toast } = useToast();
    const cardInputRef = useRef<HTMLInputElement>(null);
    const [search, setSearch] = useState("");
    const [persons, setPersons] = useState<Person[] | null>(null);
    const [selected, setSelected] = useState<Person | null>(null);
    const [cardId, setCardId] = useState("");
    const [error, setError] = useState("");
    const [assignedCount, setAssignedCount] = useState(0);

    const fetchPersons = useCallback(async () => {
        const data: Person[] = await getAllPersons(true, search || undefined);
        setPersons(data);
        return data;
    }, [search]);

    useEffect(() => {
        fetchPersons();
    }, [fetchPersons]);

    const select = (person: Person | null) => {
        setSelected(person);
        setCardId("");
        setError("");
        if (person) setTimeout(() => cardInputRef.current?.focus());
    };

    const handleAssign = async (event: FormEvent) => {
        event.preventDefault();
        if (!selected || !cardId.trim()) return;
        const status = await assignCard(selected.id, cardId.trim());
        if (status === 200) {
            toast({
                title: `Card assigned to ${selected.name}`,
                variant: "success",
            });
            setAssignedCount((count) => count + 1);
            const remaining = await fetchPersons();
            const index = (persons ?? []).findIndex(
                (person) => person.id === selected.id
            );
            select(remaining[Math.min(index, remaining.length - 1)] ?? null);
        } else if (status === 409) {
            setError("This card is already assigned to someone else.");
            cardInputRef.current?.select();
        } else {
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
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            label="Search persons without a card"
                        />
                        <ul className="flex flex-col divide-y overflow-hidden rounded-mobile-card border bg-card md:rounded-2xl">
                            {(persons ?? []).map((person) => (
                                <li key={person.id}>
                                    <button
                                        type="button"
                                        onClick={() => select(person)}
                                        aria-current={
                                            person.id === selected?.id ||
                                            undefined
                                        }
                                        className={cn(
                                            "flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent",
                                            person.id === selected?.id &&
                                                "bg-primary-soft hover:bg-primary-soft"
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
                                <li className="p-6 text-center text-sm text-muted-foreground">
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
                                Tap the card on the reader. The next person is
                                selected automatically.
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
