import { Trash2 } from "lucide-react";
import { useState } from "react";

import RequestError from "@/Components/shared/RequestError";
import SectionLoading from "@/Components/shared/SectionLoading";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { useConfirm } from "@/hooks/useConfirm";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useToast } from "@/hooks/useToast";
import {
    deleteBracket,
    H2hBracket,
    h2hRoundQuery,
    SetsToWin,
    updateBracket,
    validateSetsToWin,
} from "@/lib/h2h";

import BracketCreateForm from "./BracketCreateForm";
import BracketPreview from "./BracketPreview";
import SeedList from "./SeedList";
import SetsToWinFields from "./SetsToWinFields";

const Section = ({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: React.ReactNode;
}) => (
    <section className="flex flex-col gap-3 rounded-mobile-card border bg-card p-4 md:rounded-2xl md:p-5">
        <div className="flex flex-col gap-0.5">
            <h2 className="font-semibold">{title}</h2>
            {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
            )}
        </div>
        {children}
    </section>
);

const stageSetsToWin = (bracket: H2hBracket): SetsToWin =>
    Object.fromEntries(bracket.stages.map((s) => [s.stage, s.setsToWin]));

const SetsToWinEditor = ({
    roundId,
    bracket,
}: {
    roundId: string;
    bracket: H2hBracket;
}) => {
    const { toast } = useToast();
    const [value, setValue] = useState(stageSetsToWin(bracket));
    const [loaded, setLoaded] = useState(bracket);
    if (bracket !== loaded) {
        setLoaded(bracket);
        setValue(stageSetsToWin(bracket));
    }
    const saved = stageSetsToWin(bracket);
    const isDirty = bracket.stages.some(
        (s) => value[s.stage] !== saved[s.stage]
    );
    const save = async () => {
        const result = await updateBracket(roundId, { setsToWin: value });
        toast(
            result.ok
                ? { title: "Sets to win saved", variant: "success" }
                : {
                      title: "Sets to win not saved",
                      description: result.message,
                      variant: "destructive",
                  }
        );
    };
    return (
        <div className="flex max-w-md flex-col gap-3">
            <SetsToWinFields
                size={bracket.size}
                value={value}
                onChange={setValue}
                lockedStages={bracket.stages
                    .filter((s) => s.started)
                    .map((s) => s.stage)}
            />
            {isDirty && (
                <Button
                    className="w-fit"
                    onClick={save}
                    disabled={validateSetsToWin(bracket.size, value).length > 0}
                >
                    Save sets to win
                </Button>
            )}
        </div>
    );
};

const WcaRoundIdField = ({
    roundId,
    bracket,
}: {
    roundId: string;
    bracket: H2hBracket;
}) => {
    const { toast } = useToast();
    const saved = bracket.wcaRoundId?.toString() ?? "";
    const [value, setValue] = useState(saved);
    const [loaded, setLoaded] = useState(saved);
    if (saved !== loaded) {
        setLoaded(saved);
        setValue(saved);
    }
    const isValid = value === "" || /^[1-9]\d*$/.test(value);
    const save = async () => {
        const result = await updateBracket(roundId, {
            wcaRoundId: value === "" ? null : Number(value),
        });
        toast(
            result.ok
                ? { title: "WCA round id saved", variant: "success" }
                : {
                      title: "WCA round id not saved",
                      description: result.message,
                      variant: "destructive",
                  }
        );
    };
    return (
        <div className="flex max-w-md items-center gap-2">
            <Input
                aria-label="WCA round id"
                inputMode="numeric"
                placeholder="Not set"
                value={value}
                onChange={(e) => setValue(e.target.value.trim())}
            />
            {value !== saved && (
                <Button onClick={save} disabled={!isValid}>
                    Save
                </Button>
            )}
        </div>
    );
};

interface BracketTabProps {
    roundId: string;
}

/** Bracket setup for a head-to-head round (SPEC-001) */
const BracketTab = ({ roundId }: BracketTabProps) => {
    const {
        data: view,
        isError,
        refetch,
    } = useLiveQuery(h2hRoundQuery(roundId));
    const confirm = useConfirm();
    const { toast } = useToast();

    if (!view) {
        return isError ? (
            <RequestError onRetry={() => void refetch()} />
        ) : (
            <SectionLoading label="Loading the bracket" />
        );
    }
    const { bracket } = view;
    if (!bracket) return <BracketCreateForm view={view} />;

    const handleDelete = () =>
        confirm({
            title: "Delete the bracket?",
            description:
                "Its seeds, matches and scramble plan are deleted. You can create it again.",
            confirmLabel: "Delete",
            variant: "destructive",
            onConfirm: async () => {
                const result = await deleteBracket(roundId);
                toast(
                    result.ok
                        ? { title: "Bracket deleted", variant: "success" }
                        : {
                              title: "Bracket not deleted",
                              description: result.message,
                              variant: "destructive",
                          }
                );
            },
        }).catch(() => undefined);

    return (
        <div className="flex flex-col gap-4">
            {isError && <RequestError hasData onRetry={() => void refetch()} />}
            {bracket.status === "DRAFT" && (
                <p
                    role="status"
                    className="rounded-xl border border-warning bg-warning-soft px-4 py-2 text-sm"
                >
                    The bracket isn't fully seeded yet. Put a competitor in
                    every seed, in order, then save.
                </p>
            )}
            <Section title="Bracket">
                <BracketPreview bracket={bracket} />
            </Section>
            <div className="grid gap-4 lg:grid-cols-2">
                <Section
                    title="Seeds"
                    description="Drag to reorder. Pick a name to swap in another competitor."
                >
                    <SeedList
                        roundId={roundId}
                        bracket={bracket}
                        candidates={view.candidates}
                    />
                </Section>
                <div className="flex flex-col gap-4">
                    <Section
                        title="Sets to win"
                        description="The same for every match in a stage. A stage can't have fewer than the one before."
                    >
                        <SetsToWinEditor roundId={roundId} bracket={bracket} />
                        {view.scramblePlan && (
                            <p className="text-sm text-muted-foreground">
                                {view.scramblePlan.instruction}
                            </p>
                        )}
                    </Section>
                    <Section
                        title="WCA round id"
                        description="The WCA website's number for this round. The results file for the WCA needs it."
                    >
                        <WcaRoundIdField roundId={roundId} bracket={bracket} />
                    </Section>
                    <Section title="Delete bracket">
                        <p className="text-sm text-muted-foreground">
                            {bracket.attemptsLinked
                                ? "Attempts are recorded in its matches, so it can't be deleted."
                                : "Only while no attempt is recorded in its matches."}
                        </p>
                        <Button
                            variant="outline"
                            className="w-fit"
                            onClick={handleDelete}
                            disabled={bracket.attemptsLinked}
                        >
                            <Trash2 />
                            Delete bracket
                        </Button>
                    </Section>
                </div>
            </div>
        </div>
    );
};

export default BracketTab;
