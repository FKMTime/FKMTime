import { Lock } from "lucide-react";

import EmptyState from "@/Components/shared/EmptyState";
import RequestError from "@/Components/shared/RequestError";
import SectionLoading from "@/Components/shared/SectionLoading";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useToast } from "@/hooks/useToast";
import {
    h2hRoundQuery,
    H2hScrambleSet,
    planRowChanges,
    updateScramblePlan,
} from "@/lib/h2h";

/** Radix Select can't hold an empty value */
const NO_SET = "none";

const setLabel = (set: H2hScrambleSet) =>
    `Set ${set.set} · ${set.scramblesCount} + ${set.extraScramblesCount} extra`;

interface ScramblePlanTabProps {
    roundId: string;
}

/**
 * Which scramble set each set of each match races on (SPEC-001,
 * Scrambles). Picking a set another row has swaps the two rows.
 */
const ScramblePlanTab = ({ roundId }: ScramblePlanTabProps) => {
    const {
        data: view,
        isError,
        refetch,
    } = useLiveQuery(h2hRoundQuery(roundId));
    const { toast } = useToast();

    if (!view) {
        return isError ? (
            <RequestError onRetry={() => void refetch()} />
        ) : (
            <SectionLoading label="Loading the bracket" />
        );
    }
    const plan = view.scramblePlan;
    if (!plan) {
        return (
            <EmptyState>
                Create the bracket first. Its scramble plan follows from the
                matches.
            </EmptyState>
        );
    }
    const missing = plan.rows.filter((row) => row.scrambleSetId === null);
    const lockedSetIds = plan.rows
        .filter((row) => row.locked)
        .map((row) => row.scrambleSetId);

    const change = async (rowId: string, value: string) => {
        const rows = planRowChanges(
            plan.rows,
            rowId,
            value === NO_SET ? null : value
        );
        if (rows.length === 0) return;
        const result = await updateScramblePlan(roundId, rows);
        if (!result.ok) {
            toast({
                title: "Scramble plan not saved",
                description: result.message,
                variant: "destructive",
            });
        }
    };

    return (
        <div className="flex flex-col gap-4">
            {isError && <RequestError hasData onRetry={() => void refetch()} />}
            <section className="flex flex-col gap-1 rounded-mobile-card border bg-card p-4 text-sm md:rounded-2xl md:p-5">
                <p>{plan.instruction}</p>
                <p className="text-muted-foreground">
                    Importing scrambles for this round, or deleting one of its
                    sets, fills the rows that have no set, in match order. Rows
                    with a set keep it.
                </p>
                {missing.length > 0 && (
                    <p role="status" className="text-warning">
                        {missing.length} of {plan.rows.length}{" "}
                        {plan.rows.length === 1 ? "set has" : "sets have"} no
                        scramble set yet. Import more scrambles for this round.
                    </p>
                )}
            </section>
            <section className="overflow-hidden rounded-mobile-card border bg-card md:rounded-2xl">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Match</TableHead>
                            <TableHead>Set</TableHead>
                            <TableHead>Scramble set</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {plan.rows.map((row) => (
                            <TableRow key={row.id}>
                                <TableCell>{row.matchLabel}</TableCell>
                                <TableCell>{row.setNumber}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Select
                                            value={row.scrambleSetId ?? NO_SET}
                                            onValueChange={(value) =>
                                                void change(row.id, value)
                                            }
                                            disabled={row.locked}
                                        >
                                            <SelectTrigger
                                                aria-label={`Scramble set for ${row.matchLabel}, set ${row.setNumber}`}
                                                className="w-56"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={NO_SET}>
                                                    No set
                                                </SelectItem>
                                                {plan.scrambleSets
                                                    .filter(
                                                        (set) =>
                                                            set.id ===
                                                                row.scrambleSetId ||
                                                            (!set.raced &&
                                                                !lockedSetIds.includes(
                                                                    set.id
                                                                ))
                                                    )
                                                    .map((set) => (
                                                        <SelectItem
                                                            key={set.id}
                                                            value={set.id}
                                                        >
                                                            {setLabel(set)}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                        {row.locked && (
                                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Lock size={12} />
                                                Raced
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </section>
        </div>
    );
};

export default ScramblePlanTab;
