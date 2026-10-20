import { useAtomValue } from "jotai";
import { ChevronDown } from "lucide-react";
import { FormEvent, useMemo, useRef, useState } from "react";
import { TimeLimit } from "wcif-helpers";

import AttemptResultInput from "@/Components/AttemptResultInput";
import DeviceSelect from "@/Components/DeviceSelect";
import PersonAutocomplete from "@/Components/PersonAutocomplete";
import InlineError from "@/Components/shared/InlineError";
import SegmentedControl from "@/Components/shared/SegmentedControl";
import { Button } from "@/Components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import { Textarea } from "@/Components/ui/textarea";
import { useToast } from "@/hooks/useToast";
import { competitionAtom } from "@/lib/atoms";
import {
    AttemptOutcome,
    outcomeFromStatus,
    statusFromOutcome,
} from "@/lib/attemptOutcome";
import { AVAILABLE_PENALTIES, DNF_VALUE, DNS_VALUE } from "@/lib/constants";
import { Attempt, AttemptData, AttemptType } from "@/lib/interfaces";
import { getAttemptOptions, getNumberOfAttempts } from "@/lib/quickEntry";
import { cn } from "@/lib/utils";

interface AttemptFormProps {
    attempt?: Attempt;
    competitorId?: string;
    handleSubmit: (data: AttemptData) => void;
    onCancel?: () => void;
    isLoading: boolean;
    /** Error from saving, shown above the buttons */
    submitError?: string;
    roundId: string;
    timeLimit?: TimeLimit;
}

const LABEL = "text-[13px] font-semibold text-muted-foreground";
const COMMON_PENALTIES = [0, 2, 4, DNF_VALUE, DNS_VALUE];
const OTHER_PENALTIES = AVAILABLE_PENALTIES.filter(
    (penalty) => !COMMON_PENALTIES.includes(penalty.value)
);
const penaltyLabel = (value: number) =>
    value === 0
        ? "None"
        : AVAILABLE_PENALTIES.find((p) => p.value === value)?.label ??
          `+${value}`;

const OUTCOME_LABELS: Record<AttemptOutcome, string> = {
    counts: "Counts",
    extra: "Extra granted",
    open: "Open incident",
    scrambled: "Only scrambled",
};

/**
 * Enter or edit one attempt in plain terms: which attempt, the time, the
 * penalty and whether an extra was granted. Status, type and replaced-by are
 * derived from those choices.
 */
const AttemptForm = ({
    attempt,
    competitorId: fixedCompetitorId,
    handleSubmit,
    onCancel,
    isLoading,
    submitError,
    roundId,
    timeLimit,
}: AttemptFormProps) => {
    const formRef = useRef<HTMLFormElement>(null);
    const { toast } = useToast();
    const competition = useAtomValue(competitionAtom);
    const attemptOptions = useMemo(
        () =>
            getAttemptOptions(getNumberOfAttempts(roundId, competition?.wcif)),
        [roundId, competition?.wcif]
    );
    const extraOptions = attemptOptions.filter(
        (option) => option.type === AttemptType.EXTRA_ATTEMPT
    );
    const optionValueFor = (type: AttemptType, attemptNumber: number) =>
        attemptOptions.find(
            (o) => o.type === type && o.attemptNumber === attemptNumber
        )?.value ?? "1";

    const [competitorId, setCompetitorId] = useState(fixedCompetitorId ?? "");
    const [attemptValue, setAttemptValue] = useState(
        attempt ? optionValueFor(attempt.type, attempt.attemptNumber) : "1"
    );
    const [value, setValue] = useState(attempt?.value ?? 0);
    const [penalty, setPenalty] = useState(attempt?.penalty ?? 0);
    const [outcome, setOutcome] = useState<AttemptOutcome>(
        attempt ? outcomeFromStatus(attempt.status) : "counts"
    );
    const [replacedBy, setReplacedBy] = useState(
        attempt?.replacedBy ? String(attempt.replacedBy) : "0"
    );
    const [judgeId, setJudgeId] = useState(attempt?.judgeId ?? "");
    const [scramblerId, setScramblerId] = useState(attempt?.scramblerId ?? "");
    const [deviceId, setDeviceId] = useState(attempt?.deviceId ?? "");
    const [comment, setComment] = useState(attempt?.comment ?? "");
    const [error, setError] = useState("");
    const hasDetails = !!(judgeId || scramblerId || deviceId || comment);
    const [showDetails, setShowDetails] = useState(false);

    // Incident states are kept, never offered for a new attempt
    const outcomeOptions: AttemptOutcome[] = [
        "counts",
        "extra",
        ...(attempt && outcomeFromStatus(attempt.status) === "open"
            ? (["open"] as const)
            : []),
        ...(attempt && outcomeFromStatus(attempt.status) === "scrambled"
            ? (["scrambled"] as const)
            : []),
    ];
    const isTimeless = penalty === DNF_VALUE || penalty === DNS_VALUE;
    const isTimeOptional = outcome === "extra" || isTimeless;
    const isOtherPenalty = OTHER_PENALTIES.some((p) => p.value === penalty);

    const onSubmit = (event: FormEvent) => {
        event.preventDefault();
        setError("");
        if (!competitorId) return setError("Choose a competitor.");
        if (judgeId && judgeId === competitorId)
            return setError("The judge can't be the competitor.");
        if (scramblerId && scramblerId === competitorId)
            return setError("The scrambler can't be the competitor.");
        if (!isTimeOptional && !value)
            return setError("Enter the time, or choose DNF or DNS.");

        const option =
            attemptOptions.find((o) => o.value === attemptValue) ??
            attemptOptions[0];
        const data: AttemptData = {
            roundId,
            competitorId,
            type: option.type,
            attemptNumber: option.attemptNumber,
            status: statusFromOutcome(outcome, attempt?.status),
            value: isTimeless ? 0 : value,
            penalty,
            replacedBy: outcome === "extra" ? +replacedBy : 0,
            judgeId: judgeId || undefined,
            scramblerId: scramblerId || undefined,
            deviceId: deviceId || undefined,
            comment,
        };
        if (
            timeLimit &&
            !isTimeless &&
            data.value + data.penalty * 100 > timeLimit.centiseconds
        ) {
            data.penalty = DNF_VALUE;
            toast({ title: "Over the time limit, saved as DNF" });
        }
        handleSubmit(data);
    };

    return (
        <form
            ref={formRef}
            onSubmit={onSubmit}
            className="flex flex-col gap-[18px]"
            noValidate
        >
            {!fixedCompetitorId && (
                <div className="flex flex-col gap-2">
                    <span className={LABEL}>Competitor</span>
                    <PersonAutocomplete
                        onSelect={(person) => setCompetitorId(person?.id ?? "")}
                        defaultValue={competitorId}
                    />
                </div>
            )}

            <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
                <div className="flex flex-col gap-2">
                    <span className={LABEL}>Attempt</span>
                    <SegmentedControl
                        label="Attempt"
                        value={attemptValue}
                        onValueChange={setAttemptValue}
                        className="[&>button]:min-w-8 [&>button]:px-1.5 [&>button]:font-bold"
                        options={attemptOptions.map((option) => ({
                            value: option.value,
                            label: option.value,
                            ariaLabel: option.title,
                        }))}
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label htmlFor="attempt-form-time" className={LABEL}>
                        Time
                        {isTimeOptional && (
                            <span className="font-normal text-faint">
                                {" "}
                                · optional
                            </span>
                        )}
                    </label>
                    <AttemptResultInput
                        id="attempt-form-time"
                        value={isTimeless ? 0 : value}
                        onChange={setValue}
                        disabled={isTimeless}
                        onEnter={() => formRef.current?.requestSubmit()}
                        placeholder="0.00"
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
                    {COMMON_PENALTIES.map((option) => (
                        <button
                            key={option}
                            type="button"
                            role="radio"
                            aria-checked={penalty === option}
                            onClick={() => setPenalty(option)}
                            className={cn(
                                "h-11 whitespace-nowrap rounded-lg border text-[13px] font-bold transition-colors md:h-[34px]",
                                penalty === option
                                    ? "border-primary bg-primary-soft text-primary"
                                    : "hover:bg-accent"
                            )}
                        >
                            {penaltyLabel(option)}
                        </button>
                    ))}
                    <Select
                        value={isOtherPenalty ? String(penalty) : ""}
                        onValueChange={(v) => setPenalty(+v)}
                    >
                        <SelectTrigger
                            aria-label="Other penalty"
                            className={cn(
                                "h-11 text-[13px] font-bold md:h-[34px]",
                                isOtherPenalty &&
                                    "border-primary bg-primary-soft text-primary"
                            )}
                        >
                            <SelectValue placeholder="Other" />
                        </SelectTrigger>
                        <SelectContent>
                            {OTHER_PENALTIES.map((p) => (
                                <SelectItem
                                    key={p.value}
                                    value={String(p.value)}
                                >
                                    {p.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <span className={LABEL}>Outcome</span>
                <SegmentedControl
                    label="Outcome"
                    value={outcome}
                    onValueChange={setOutcome}
                    options={outcomeOptions.map((o) => ({
                        value: o,
                        label: OUTCOME_LABELS[o],
                    }))}
                />
                {outcome === "extra" && (
                    <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-[13px] text-muted-foreground">
                            Replaced by
                        </span>
                        <SegmentedControl
                            label="Replaced by"
                            value={replacedBy}
                            onValueChange={setReplacedBy}
                            options={[
                                { value: "0", label: "Not yet" },
                                ...extraOptions.map((o) => ({
                                    value: String(o.attemptNumber),
                                    label: o.value,
                                    ariaLabel: `Replaced by ${o.value}`,
                                })),
                            ]}
                        />
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-3 rounded-xl border px-3.5 py-2.5">
                <button
                    type="button"
                    aria-expanded={showDetails}
                    onClick={() => setShowDetails((v) => !v)}
                    className="flex items-center justify-between gap-2 text-left text-[13px] font-semibold text-muted-foreground"
                >
                    <span>
                        More details
                        <span className="font-normal text-faint">
                            {" "}
                            · judge, scrambler, station, comment
                            {hasDetails && !showDetails ? " (filled in)" : ""}
                        </span>
                    </span>
                    <ChevronDown
                        className={cn(
                            "size-4 shrink-0 transition-transform",
                            showDetails && "rotate-180"
                        )}
                    />
                </button>
                {showDetails && (
                    <div className="grid grid-cols-1 gap-3 pb-1 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                            <span className={LABEL}>Judge</span>
                            <PersonAutocomplete
                                onSelect={(p) => setJudgeId(p?.id ?? "")}
                                defaultValue={judgeId}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <span className={LABEL}>Scrambler</span>
                            <PersonAutocomplete
                                onSelect={(p) => setScramblerId(p?.id ?? "")}
                                defaultValue={scramblerId}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <span className={LABEL}>Station</span>
                            <DeviceSelect
                                value={deviceId}
                                onChange={setDeviceId}
                            />
                        </div>
                        <label className="flex flex-col gap-1.5 sm:col-span-2">
                            <span className={LABEL}>Comment</span>
                            <Textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                rows={2}
                            />
                        </label>
                    </div>
                )}
            </div>

            <InlineError className="py-2 text-[13px]">
                {error || submitError}
            </InlineError>

            <div className="flex justify-end gap-2 border-t pt-3.5 max-md:[&>button]:flex-1">
                {onCancel && (
                    <Button type="button" variant="ghost" onClick={onCancel}>
                        Cancel
                    </Button>
                )}
                <Button type="submit" disabled={isLoading}>
                    Save attempt
                </Button>
            </div>
        </form>
    );
};

export default AttemptForm;
