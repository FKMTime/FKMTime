import { useAtomValue } from "jotai";
import { X } from "lucide-react";
import {
    FormEvent,
    KeyboardEvent,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import InlineError from "@/Components/shared/InlineError";
import SegmentedControl from "@/Components/shared/SegmentedControl";
import { Button } from "@/Components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/Components/ui/dialog";
import { Input } from "@/Components/ui/input";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import { createAttempt } from "@/lib/attempt";
import { DNF_VALUE, DNS_VALUE } from "@/lib/constants";
import { getEventIconClass } from "@/lib/events";
import { Attempt, AttemptStatus, Person, Result } from "@/lib/interfaces";
import { getAllPersons } from "@/lib/persons";
import {
    getAttemptOptions,
    getNextAttemptValue,
    getNumberOfAttempts,
    isRegisteredFor,
    matchCompetitors,
    parseQuickTime,
} from "@/lib/quickEntry";
import { reformatInput, resultToString } from "@/lib/resultFormatters";
import { getResultsByRoundId } from "@/lib/results";
import { cn, getSubmissionPlatformName } from "@/lib/utils";

export interface QuickEntryRound {
    roundId: string;
    /** Where it runs, e.g. "Main room · Group 2" */
    meta: string;
}

interface QuickEnterAttemptModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Fixed round; when omitted the user picks one of roundOptions */
    roundId?: string;
    roundOptions?: QuickEntryRound[];
}

const PENALTIES = [
    { value: 0, label: "None" },
    { value: 2, label: "+2" },
    { value: 4, label: "+4" },
    { value: DNF_VALUE, label: "DNF" },
    { value: DNS_VALUE, label: "DNS" },
];

const LABEL = "text-[13px] font-semibold text-muted-foreground";

const shortRoundName = (roundId: string) =>
    activityCodeToName(roundId, true).replace(", ", " · ");

/** Keyboard-first attempt entry: type a competitor, the time, press Enter */
const QuickEnterAttemptModal = ({
    isOpen,
    onClose,
    roundId: fixedRoundId,
    roundOptions = [],
}: QuickEnterAttemptModalProps) => {
    const { toast } = useToast();
    const competition = useAtomValue(competitionAtom);
    const timeInputRef = useRef<HTMLInputElement>(null);
    const [persons, setPersons] = useState<Person[]>([]);
    const [selectedRoundId, setSelectedRoundId] = useState<string>();
    const [query, setQuery] = useState("");
    const [highlighted, setHighlighted] = useState(0);
    const [competitor, setCompetitor] = useState<Person | null>(null);
    const [attempt, setAttempt] = useState("1");
    const [time, setTime] = useState("");
    const [penalty, setPenalty] = useState(0);
    const [error, setError] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const roundId =
        fixedRoundId ??
        (roundOptions.some((option) => option.roundId === selectedRoundId)
            ? selectedRoundId
            : roundOptions[0]?.roundId);
    const eventId = roundId?.split("-r")[0] ?? "";
    const wcif = competition?.wcif;

    useEffect(() => {
        if (isOpen) getAllPersons().then(setPersons);
    }, [isOpen]);

    // Existing attempts per competitor, to preselect their next attempt
    const [roundAttempts, setRoundAttempts] = useState<Map<string, Attempt[]>>(
        new Map()
    );
    useEffect(() => {
        if (!isOpen || !roundId) return;
        let isCancelled = false;
        getResultsByRoundId(roundId).then((results: Result[]) => {
            if (isCancelled) return;
            setRoundAttempts(
                new Map(results.map((r) => [r.person.id, r.attempts]))
            );
        });
        return () => {
            isCancelled = true;
        };
    }, [isOpen, roundId]);

    const attemptOptions = useMemo(
        () =>
            roundId
                ? getAttemptOptions(getNumberOfAttempts(roundId, wcif))
                : [],
        [roundId, wcif]
    );
    const matches =
        wcif && !competitor
            ? matchCompetitors(persons, wcif, eventId, query)
            : [];
    const isTimeless = penalty === DNF_VALUE || penalty === DNS_VALUE;

    const reset = () => {
        setQuery("");
        setCompetitor(null);
        setAttempt("1");
        setTime("");
        setPenalty(0);
        setError("");
    };

    const close = () => {
        reset();
        onClose();
    };

    const pick = (person: Person) => {
        setCompetitor(person);
        setAttempt(
            getNextAttemptValue(
                attemptOptions,
                roundAttempts.get(person.id) ?? []
            )
        );
        setQuery("");
        setError("");
        // Next field in the keyboard flow
        setTimeout(() => timeInputRef.current?.focus());
    };

    const selectRound = (id: string) => {
        setSelectedRoundId(id);
        const nextEventId = id.split("-r")[0];
        if (
            competitor &&
            wcif &&
            !isRegisteredFor(competitor, wcif, nextEventId)
        )
            setCompetitor(null);
    };

    const handleSubmit = async (event?: FormEvent) => {
        event?.preventDefault();
        if (!roundId || isSaving) return;
        if (!competitor) {
            if (matches.length) return pick(matches[highlighted] ?? matches[0]);
            return setError("Choose a competitor.");
        }
        const value = isTimeless ? 0 : parseQuickTime(time);
        if (value === null)
            return setError("Enter a time like 9.84 or 1:02.31.");
        const option = attemptOptions.find((o) => o.value === attempt);
        if (!option) return;

        setIsSaving(true);
        const { status, message } = await createAttempt({
            roundId,
            competitorId: competitor.id,
            attemptNumber: option.attemptNumber,
            type: option.type,
            status: AttemptStatus.STANDARD,
            value,
            penalty,
            comment: "",
        });
        setIsSaving(false);
        if (status !== 201) {
            setError(message ?? "Something went wrong");
            return;
        }
        const result = isTimeless
            ? resultToString(penalty)
            : `${resultToString(value)}${penalty ? ` (+${penalty})` : ""}`;
        toast({
            title: `Saved ${competitor.name} · ${shortRoundName(roundId)} · ${option.title} · ${result}`,
            description: `Submitted to ${getSubmissionPlatformName(eventId)}`,
            variant: "success",
        });
        close();
    };

    const handleCompetitorKeyDown = (
        event: KeyboardEvent<HTMLInputElement>
    ) => {
        if (!matches.length) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const step = event.key === "ArrowDown" ? 1 : matches.length - 1;
            setHighlighted((current) => (current + step) % matches.length);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
            <DialogContent className="gap-[18px] sm:max-w-[560px]">
                <DialogHeader>
                    <DialogTitle>Enter attempt</DialogTitle>
                    <DialogDescription
                        className={cn(!fixedRoundId && "sr-only")}
                    >
                        {fixedRoundId
                            ? activityCodeToName(fixedRoundId).replace(
                                  ", ",
                                  " · "
                              )
                            : "Pick the round, the competitor and the time"}
                    </DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={handleSubmit}
                    className="flex flex-col gap-[18px]"
                    noValidate
                >
                    {!fixedRoundId && (
                        <div className="flex flex-col gap-2">
                            <span className={LABEL}>Round</span>
                            {roundOptions.length === 0 ? (
                                <p className="rounded-xl bg-secondary px-3.5 py-3 text-sm text-muted-foreground">
                                    No round is in progress.
                                </p>
                            ) : (
                                <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2">
                                    {roundOptions.map((option) => {
                                        const isSelected =
                                            option.roundId === roundId;
                                        return (
                                            <button
                                                key={option.roundId}
                                                type="button"
                                                aria-pressed={isSelected}
                                                onClick={() =>
                                                    selectRound(option.roundId)
                                                }
                                                className={cn(
                                                    "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                                                    isSelected
                                                        ? "border-primary bg-primary-soft text-primary"
                                                        : "hover:bg-accent"
                                                )}
                                            >
                                                <span
                                                    aria-hidden
                                                    className={cn(
                                                        "cubing-icon text-xl",
                                                        getEventIconClass(
                                                            option.roundId.split(
                                                                "-r"
                                                            )[0]
                                                        )
                                                    )}
                                                />
                                                <span className="flex min-w-0 flex-col">
                                                    <span className="text-sm font-semibold">
                                                        {shortRoundName(
                                                            option.roundId
                                                        )}
                                                    </span>
                                                    <span className="truncate text-xs text-muted-foreground">
                                                        {option.meta}
                                                    </span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                    <div className="flex flex-col gap-2">
                        <label
                            htmlFor="quick-entry-competitor"
                            className={LABEL}
                        >
                            Competitor
                        </label>
                        {competitor ? (
                            <div className="flex h-11 items-center gap-2.5 rounded-lg border border-primary bg-background pl-3 pr-1.5 md:h-[42px]">
                                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                                    {competitor.name}
                                </span>
                                <span className="font-mono text-xs text-muted-foreground">
                                    #{competitor.registrantId}
                                </span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    className="md:size-[30px]"
                                    aria-label="Change competitor"
                                    onClick={() => setCompetitor(null)}
                                >
                                    <X />
                                </Button>
                            </div>
                        ) : (
                            <>
                                <Input
                                    id="quick-entry-competitor"
                                    value={query}
                                    onChange={(event) => {
                                        setQuery(event.target.value);
                                        setHighlighted(0);
                                    }}
                                    onKeyDown={handleCompetitorKeyDown}
                                    placeholder="Type a name or registrant ID"
                                    autoComplete="off"
                                    autoFocus
                                    role="combobox"
                                    aria-expanded={matches.length > 0}
                                    aria-controls="quick-entry-matches"
                                />
                                {matches.length > 0 && (
                                    <ul
                                        id="quick-entry-matches"
                                        role="listbox"
                                        className="flex flex-col rounded-lg border bg-background p-1"
                                    >
                                        {matches.map((person, index) => (
                                            <li
                                                key={person.id}
                                                role="option"
                                                aria-selected={
                                                    index === highlighted
                                                }
                                            >
                                                <button
                                                    type="button"
                                                    tabIndex={-1}
                                                    onClick={() => pick(person)}
                                                    className={cn(
                                                        "flex w-full justify-between gap-2.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent",
                                                        index === highlighted &&
                                                            "bg-accent"
                                                    )}
                                                >
                                                    <span>{person.name}</span>
                                                    <span className="font-mono text-xs text-muted-foreground">
                                                        #{person.registrantId}
                                                    </span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {query.trim() && matches.length === 0 && (
                                    <span className="text-[13px] text-muted-foreground">
                                        No competitor in this event matches "
                                        {query.trim()}"
                                    </span>
                                )}
                            </>
                        )}
                    </div>
                    <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
                        <div className="flex flex-col gap-2">
                            <span className={LABEL}>Attempt</span>
                            <SegmentedControl
                                label="Attempt"
                                value={attempt}
                                onValueChange={setAttempt}
                                className="[&>button]:min-w-8 [&>button]:px-1.5 [&>button]:font-bold"
                                options={attemptOptions.map((option) => ({
                                    value: option.value,
                                    label: option.value,
                                    ariaLabel: option.title,
                                }))}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label htmlFor="quick-entry-time" className={LABEL}>
                                Time
                            </label>
                            <Input
                                id="quick-entry-time"
                                ref={timeInputRef}
                                value={isTimeless ? "" : time}
                                onChange={(event) =>
                                    setTime(reformatInput(event.target.value))
                                }
                                placeholder="0.00"
                                inputMode="numeric"
                                autoComplete="off"
                                disabled={isTimeless}
                                className="text-lg font-semibold md:h-[38px] md:text-lg"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <span className={LABEL}>Penalty</span>
                        <div
                            role="radiogroup"
                            aria-label="Penalty"
                            className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5"
                        >
                            {PENALTIES.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={penalty === option.value}
                                    onClick={() => setPenalty(option.value)}
                                    className={cn(
                                        "h-11 whitespace-nowrap rounded-lg border text-[13px] font-bold transition-colors md:h-[34px]",
                                        penalty === option.value
                                            ? "border-primary bg-primary-soft text-primary"
                                            : "hover:bg-accent"
                                    )}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <InlineError className="py-2 text-[13px]">
                        {error}
                    </InlineError>
                    <div className="flex flex-wrap items-center justify-between gap-2.5 border-t pt-3.5">
                        <span className="text-xs text-faint max-md:hidden">
                            Press Enter to save
                        </span>
                        <div className="flex gap-2 max-md:w-full">
                            <Button
                                type="button"
                                variant="ghost"
                                className="max-md:flex-1"
                                onClick={close}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                className="max-md:flex-1"
                                disabled={isSaving || !roundId}
                            >
                                Save attempt
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default QuickEnterAttemptModal;
