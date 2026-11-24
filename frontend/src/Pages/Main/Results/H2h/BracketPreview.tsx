import { Badge } from "@/Components/ui/badge";
import {
    H2hBracket,
    H2hMatch,
    H2hSide,
    MATCH_STATUS_LABELS,
    sideLabel,
} from "@/lib/h2h";
import { cn } from "@/lib/utils";

interface BracketPreviewProps {
    bracket: H2hBracket;
}

const SideRow = ({ side, bracket }: { side: H2hSide; bracket: H2hBracket }) => {
    const entrant = bracket.entrants.find((e) => e.id === side.entrantId);
    return (
        <div className="flex items-center gap-2 text-sm">
            <span className="w-5 shrink-0 text-right font-mono text-xs text-muted-foreground">
                {entrant?.seed ?? ""}
            </span>
            <span
                className={cn(
                    "truncate",
                    !entrant && "italic text-muted-foreground"
                )}
            >
                {sideLabel(side, bracket)}
            </span>
        </div>
    );
};

const MatchCard = ({
    match,
    bracket,
}: {
    match: H2hMatch;
    bracket: H2hBracket;
}) => (
    <div
        aria-label={match.label}
        className="flex flex-col gap-1 rounded-lg border bg-background p-2"
    >
        <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground">
                {match.label}
            </span>
            <Badge variant={match.status === "READY" ? "default" : "secondary"}>
                {MATCH_STATUS_LABELS[match.status]}
            </Badge>
        </div>
        <SideRow side={match.sideA} bracket={bracket} />
        <SideRow side={match.sideB} bracket={bracket} />
        <span className="text-xs text-muted-foreground">
            First to {match.setsToWin} {match.setsToWin === 1 ? "set" : "sets"}
        </span>
    </div>
);

/**
 * The bracket as it stands, stages as columns left to right; the
 * third-place match sits under the final
 */
const BracketPreview = ({ bracket }: BracketPreviewProps) => {
    const columns = bracket.stages
        .filter((stage) => stage.stage !== "THIRD_PLACE")
        .map((stage) => ({
            ...stage,
            matches: bracket.matches
                .filter(
                    (match) =>
                        match.stage === stage.stage ||
                        (stage.stage === "FINAL" &&
                            match.stage === "THIRD_PLACE")
                )
                // The final on top, though its number comes last
                .sort(
                    (x, y) =>
                        Number(x.stage === "THIRD_PLACE") -
                        Number(y.stage === "THIRD_PLACE")
                ),
        }));
    return (
        <div className="flex gap-3 overflow-x-auto pb-2">
            {columns.map((column) => (
                <div
                    key={column.stage}
                    className="flex w-56 shrink-0 flex-col gap-2"
                >
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {column.label}
                    </h3>
                    <div className="flex flex-1 flex-col justify-around gap-2">
                        {column.matches.map((match) => (
                            <MatchCard
                                key={match.id}
                                match={match}
                                bracket={bracket}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default BracketPreview;
