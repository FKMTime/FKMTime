import { Competition as WCIF, getRoundInfoFromWcif } from "wcif-helpers";

import { formattedBest } from "@/lib/average";
import { Result } from "@/lib/interfaces";
import { TV_RESULT_ROWS } from "@/lib/publicTv";
import { getNumberOfAttempts } from "@/lib/quickEntry";
import { rankResults } from "@/lib/ranking";
import {
    attemptWithPenaltyToString,
    resultToString,
} from "@/lib/resultFormatters";

interface TvResultsSlideProps {
    wcif: WCIF;
    roundId: string;
    /** null while this round's results load */
    results: Result[] | null;
}

/** The top of a round's ranking, sized to be read from across the room */
const TvResultsSlide = ({ wcif, roundId, results }: TvResultsSlideProps) => {
    const format = getRoundInfoFromWcif(roundId, wcif)?.format ?? "a";
    const maxAttempts = getNumberOfAttempts(roundId, wcif);
    const rows = rankResults(results ?? [], maxAttempts, format).slice(
        0,
        TV_RESULT_ROWS
    );

    return (
        <section className="flex flex-col gap-4">
            {rows.length === 0 ? (
                <p className="py-16 text-center text-2xl text-muted-foreground">
                    {results ? "No results yet" : ""}
                </p>
            ) : (
                <table className="w-full text-left text-xl">
                    <thead>
                        <tr className="text-base text-muted-foreground">
                            <th className="w-14 py-2 font-semibold">#</th>
                            <th className="py-2 font-semibold">Name</th>
                            {Array.from({ length: maxAttempts }, (_, i) => (
                                <th
                                    key={i}
                                    className="px-3 py-2 text-right font-semibold"
                                >
                                    {i + 1}
                                </th>
                            ))}
                            <th className="px-3 py-2 text-right font-semibold">
                                {format === "a" || format === "m"
                                    ? "Average"
                                    : "Best"}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.result.id} className="border-t">
                                <td className="py-2.5 font-bold text-muted-foreground">
                                    {row.position ?? ""}
                                </td>
                                <td className="truncate py-2.5 text-2xl font-semibold">
                                    {row.result.person.name}
                                </td>
                                {Array.from(
                                    { length: maxAttempts },
                                    (_, i) => row.submitted[i]
                                ).map((attempt, i) => (
                                    <td
                                        key={i}
                                        className="px-3 py-2.5 text-right text-muted-foreground"
                                    >
                                        {attempt
                                            ? attemptWithPenaltyToString(
                                                  attempt
                                              )
                                            : ""}
                                    </td>
                                ))}
                                <td className="px-3 py-2.5 text-right text-2xl font-bold">
                                    {format === "a" || format === "m"
                                        ? row.average === null
                                            ? "—"
                                            : resultToString(row.average)
                                        : formattedBest(row.submitted) || "—"}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    );
};

export default TvResultsSlide;
