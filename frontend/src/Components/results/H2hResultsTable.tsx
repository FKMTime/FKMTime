import FlagIcon from "@/Components/Icons/FlagIcon";
import { STAGE_LABELS } from "@/lib/h2h";
import { PublicH2hEntrant, rankedEntrants } from "@/lib/h2hPublic";
import { resultToString } from "@/lib/resultFormatters";
import { cn, regionNameByIso2 } from "@/lib/utils";

const bestText = (entrant: PublicH2hEntrant) =>
    entrant.bestSingle === null ? "—" : resultToString(entrant.bestSingle);

const stageText = (entrant: PublicH2hEntrant) =>
    entrant.stageReached ? STAGE_LABELS[entrant.stageReached] : "—";

/**
 * A head-to-head round's results: the positions and stage reached the
 * backend gives from the bracket (9f16b), and each best single. No
 * attempts or average: the bracket shows the times.
 */
const H2hResultsTable = ({ entrants }: { entrants: PublicH2hEntrant[] }) => {
    const rows = rankedEntrants(entrants);
    const isPodium = (entrant: PublicH2hEntrant) =>
        entrant.position !== null && entrant.position <= 3;
    return (
        <>
            <div className="hidden overflow-x-auto min-[1120px]:block">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="text-xs text-muted-foreground">
                            <th className="w-12 py-2.5 pl-5 pr-2 font-semibold">
                                #
                            </th>
                            <th className="px-3 py-2.5 font-semibold">Name</th>
                            <th className="px-3 py-2.5 font-semibold">
                                Representing
                            </th>
                            <th className="px-3 py-2.5 font-semibold">
                                Stage reached
                            </th>
                            <th className="w-24 py-2.5 pl-3 pr-5 text-right font-semibold">
                                Best
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((entrant) => (
                            <tr
                                key={entrant.id}
                                className={cn(
                                    "border-t",
                                    isPodium(entrant) && "bg-success-soft"
                                )}
                            >
                                <td
                                    className={cn(
                                        "py-2.5 pl-5 pr-2",
                                        isPodium(entrant)
                                            ? "font-bold text-success"
                                            : "text-muted-foreground"
                                    )}
                                >
                                    {entrant.position}
                                </td>
                                <td className="px-3 py-2.5 font-semibold">
                                    {entrant.name}
                                </td>
                                <td className="px-3 py-2.5">
                                    {entrant.countryIso2 && (
                                        <span className="flex items-center gap-2">
                                            <FlagIcon
                                                country={entrant.countryIso2}
                                                size={16}
                                            />
                                            {regionNameByIso2(
                                                entrant.countryIso2
                                            )}
                                        </span>
                                    )}
                                </td>
                                <td className="px-3 py-2.5">
                                    {stageText(entrant)}
                                </td>
                                <td className="py-2.5 pl-3 pr-5 text-right font-bold">
                                    {bestText(entrant)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <ol className="flex flex-col divide-y min-[1120px]:hidden">
                {rows.map((entrant) => (
                    <li
                        key={entrant.id}
                        className={cn(
                            "flex items-center gap-3 px-4 py-2.5",
                            isPodium(entrant) && "bg-success-soft"
                        )}
                    >
                        <span
                            className={cn(
                                "w-6 text-sm",
                                isPodium(entrant)
                                    ? "font-bold text-success"
                                    : "text-faint"
                            )}
                        >
                            {entrant.position}
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                                {entrant.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                                {stageText(entrant)}
                            </p>
                        </div>
                        <div className="text-right text-sm">
                            <p className="font-bold">{bestText(entrant)}</p>
                        </div>
                    </li>
                ))}
            </ol>
        </>
    );
};

export default H2hResultsTable;
