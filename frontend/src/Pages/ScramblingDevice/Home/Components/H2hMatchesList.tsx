import { Shuffle, TriangleAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/Components/ui/button";
import { H2hMatchScramble } from "@/lib/interfaces";

import { h2hScramblePath } from "../../scramblingDeviceContext";

interface H2hMatchesListProps {
    /** null while loading */
    matches: H2hMatchScramble[] | null;
    /** The round is in progress in this room */
    canScramble: boolean;
    /** The last read failed: what is shown may be out of date */
    isStale?: boolean;
}

/**
 * A head-to-head round's playing matches, each with the set in use and its
 * next point's scramble; the scrambler picks the one to scramble for
 * (SPEC-001, On the day)
 */
const H2hMatchesList = ({
    matches,
    canScramble,
    isStale = false,
}: H2hMatchesListProps) => {
    const navigate = useNavigate();

    const staleWarning = isStale && (
        <p
            role="alert"
            className="flex items-start gap-2 border-b bg-warning-soft px-5 py-3 text-sm font-semibold text-warning"
        >
            <TriangleAlert className="mt-px size-[18px] shrink-0" />
            Can&apos;t reach the server. The matches shown may be out of date.
        </p>
    );

    if (!matches) return staleWarning || null;

    if (!matches.length) {
        return (
            <>
                {staleWarning}
                <p className="border-b px-5 py-6 text-center text-muted-foreground">
                    No match is playing. The stage leader starts matches in the
                    Matches tab.
                </p>
            </>
        );
    }

    return (
        <>
            {staleWarning}
            <ul className="divide-y border-b" aria-label="Playing matches">
                {matches.map((match) => {
                    const { scramble } = match;
                    return (
                        <li
                            key={match.matchId}
                            className="flex min-h-16 flex-wrap items-center gap-3 py-2.5 pl-4 pr-3 md:pl-5"
                        >
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="text-[15px] font-semibold">
                                    {match.label}
                                </span>
                                <span className="text-[13px] text-muted-foreground">
                                    {match.text}
                                </span>
                                {match.warning && (
                                    <span className="flex items-start gap-1.5 text-[13px] font-semibold text-warning">
                                        <TriangleAlert className="mt-px size-4 shrink-0" />
                                        {match.warning}
                                    </span>
                                )}
                            </div>
                            {canScramble && scramble && (
                                <Button
                                    className="h-11 md:h-11"
                                    aria-label={`Scramble for ${match.label}`}
                                    onClick={() =>
                                        navigate(
                                            h2hScramblePath(
                                                match.matchId,
                                                scramble.scrambleSetId
                                            )
                                        )
                                    }
                                >
                                    <Shuffle />
                                    Scramble
                                </Button>
                            )}
                        </li>
                    );
                })}
            </ul>
        </>
    );
};

export default H2hMatchesList;
