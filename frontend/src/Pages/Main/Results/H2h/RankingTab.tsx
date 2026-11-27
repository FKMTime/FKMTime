import EmptyState from "@/Components/shared/EmptyState";
import RequestError from "@/Components/shared/RequestError";
import SectionLoading from "@/Components/shared/SectionLoading";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { DNF_VALUE, DNS_VALUE } from "@/lib/constants";
import { H2hEntrant, h2hRoundQuery, STAGE_LABELS } from "@/lib/h2h";
import { resultToString } from "@/lib/resultFormatters";

import WcaExportPanel from "./WcaExportPanel";

/** The best single as the WCA writes it, or nothing before any attempt */
const bestText = (best: number | null) => {
    if (best === null) return "";
    if (best === DNF_VALUE) return "DNF";
    if (best === DNS_VALUE) return "DNS";
    return resultToString(best);
};

/** Placed first, then still in play by seed */
const byPosition = (x: H2hEntrant, y: H2hEntrant) =>
    (x.position ?? Infinity) - (y.position ?? Infinity) || x.seed - y.seed;

interface RankingTabProps {
    roundId: string;
}

/**
 * The round's standings (9f16b), as the backend ranks them: the final and
 * the third-place match give 1 to 4, then everyone else by the stage they
 * were knocked out in and their best single
 */
const RankingTab = ({ roundId }: RankingTabProps) => {
    const {
        data: view,
        isError,
        refetch,
    } = useLiveQuery(h2hRoundQuery(roundId));

    if (!view) {
        return isError ? (
            <RequestError onRetry={() => void refetch()} />
        ) : (
            <SectionLoading label="Loading the ranking" />
        );
    }
    const bracket = view.bracket;
    if (!bracket || bracket.entrants.length === 0) {
        return (
            <EmptyState>
                The ranking follows the matches once the bracket is seeded.
            </EmptyState>
        );
    }
    const entrants = [...bracket.entrants].sort(byPosition);

    return (
        <div className="flex flex-col gap-4">
            {bracket.status === "FINISHED" && (
                <WcaExportPanel roundId={roundId} />
            )}
            <section className="overflow-hidden rounded-mobile-card border bg-card md:rounded-2xl">
                {bracket.status !== "FINISHED" && (
                    <p className="border-b px-3 py-2 text-sm text-muted-foreground md:px-5">
                        Positions fill in as competitors are knocked out. The
                        rest are still playing.
                    </p>
                )}
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12 pl-5">#</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead className="text-right">Best</TableHead>
                            <TableHead>Stage reached</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {entrants.map((entrant) => (
                            <TableRow key={entrant.id}>
                                <TableCell className="pl-5 text-muted-foreground">
                                    {entrant.position ?? ""}
                                </TableCell>
                                <TableCell className="font-semibold">
                                    {entrant.person.name}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {bestText(entrant.bestSingle)}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                    {entrant.stageReached
                                        ? STAGE_LABELS[entrant.stageReached]
                                        : ""}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </section>
        </div>
    );
};

export default RankingTab;
