import { Competition as WCIF, getNumberOfAttemptsForRound } from "wcif-helpers";

import FlagIcon from "@/Components/Icons/FlagIcon";
import EventChips from "@/Components/shared/EventChips";
import SegmentedControl from "@/Components/shared/SegmentedControl";
import { StatusDot } from "@/Components/shared/StatusBadge";
import { formattedBest } from "@/lib/average";
import {
    getEventIconClass,
    getEventName,
    getEventShortName,
} from "@/lib/events";
import { Result } from "@/lib/interfaces";
import { rankResults } from "@/lib/ranking";
import {
    attemptWithPenaltyToString,
    resultToString,
} from "@/lib/resultFormatters";
import { getRoundMeta } from "@/lib/roundInfo";
import { cn, getAdvancementText, regionNameByIso2 } from "@/lib/utils";

interface PublicResultsBoardProps {
    wcif: WCIF;
    roundId: string;
    results: Result[];
    /** Rounds with a group in progress, marked with a dot */
    liveRoundIds: string[];
    onRoundChange: (roundId: string) => void;
}

/**
 * Event chips, round switch and ranked results. Shared by the staff public
 * view and the public display; a table from 1120px, a list below.
 */
const PublicResultsBoard = ({
    wcif,
    roundId,
    results,
    liveRoundIds,
    onRoundChange,
}: PublicResultsBoardProps) => {
    const eventId = roundId.split("-")[0];
    const event = wcif.events.find((e) => e.id === eventId);
    const round = event?.rounds.find((r) => r.id === roundId);
    const maxAttempts = roundId
        ? getNumberOfAttemptsForRound(roundId, wcif)
        : 0;
    const rows = rankResults(results, maxAttempts, round?.format ?? "a");
    const meta = roundId ? getRoundMeta(roundId, wcif) : null;
    const advancement = event ? getAdvancementText(roundId, event) : null;
    const status = liveRoundIds.includes(roundId)
        ? "In progress"
        : rows.length
          ? `${rows.length} ${rows.length === 1 ? "competitor" : "competitors"}`
          : "Not started";

    const pickEvent = (id: string) => {
        const rounds = wcif.events.find((e) => e.id === id)?.rounds ?? [];
        const live = rounds.find((r) => liveRoundIds.includes(r.id));
        onRoundChange((live ?? rounds[rounds.length - 1] ?? rounds[0]).id);
    };

    const averageText = (average: number | null) =>
        average === null ? "—" : resultToString(average);
    const bestText = (row: (typeof rows)[number]) =>
        formattedBest(row.submitted) || "—";

    return (
        <div className="flex flex-col gap-4">
            <EventChips
                value={eventId}
                onValueChange={pickEvent}
                events={wcif.events.map((e) => ({
                    id: e.id,
                    label: getEventShortName(e.id) || e.id,
                    name: getEventName(e.id) || e.id,
                    live: e.rounds.some((r) => liveRoundIds.includes(r.id)),
                }))}
            />

            {roundId && (
                <section className="overflow-hidden rounded-mobile-card border bg-card md:rounded-2xl">
                    <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3.5 md:px-5">
                        <span
                            aria-hidden
                            className={cn(
                                "cubing-icon text-[22px]",
                                getEventIconClass(eventId)
                            )}
                        />
                        <div className="flex min-w-40 flex-1 flex-col gap-0.5">
                            <h2 className="text-base font-bold">
                                {getEventName(eventId)} · Round{" "}
                                {roundId.split("-r")[1]}
                            </h2>
                            <p className="text-[13px] text-muted-foreground">
                                {[meta?.format, status, advancement]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </p>
                        </div>
                        {event && event.rounds.length > 1 && (
                            <SegmentedControl
                                label="Round"
                                value={roundId}
                                onValueChange={onRoundChange}
                                options={event.rounds.map((r) => ({
                                    value: r.id,
                                    ariaLabel: `Round ${r.id.split("-r")[1]}${liveRoundIds.includes(r.id) ? ", live" : ""}`,
                                    label: (
                                        <>
                                            Round {r.id.split("-r")[1]}
                                            {liveRoundIds.includes(r.id) && (
                                                <StatusDot tone="primary" />
                                            )}
                                        </>
                                    ),
                                }))}
                            />
                        )}
                    </div>

                    {rows.length === 0 ? (
                        <p className="p-8 text-center text-sm text-muted-foreground">
                            No results yet.
                        </p>
                    ) : (
                        <>
                            <div className="hidden overflow-x-auto min-[1120px]:block">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="text-xs text-muted-foreground">
                                            <th className="w-12 py-2.5 pl-5 pr-2 font-semibold">
                                                #
                                            </th>
                                            <th className="px-3 py-2.5 font-semibold">
                                                Name
                                            </th>
                                            <th className="px-3 py-2.5 font-semibold">
                                                Representing
                                            </th>
                                            {Array.from(
                                                { length: maxAttempts },
                                                (_, i) => (
                                                    <th
                                                        key={i}
                                                        className="w-20 px-2 py-2.5 text-right font-semibold"
                                                    >
                                                        {i + 1}
                                                    </th>
                                                )
                                            )}
                                            <th className="w-24 px-3 py-2.5 text-right font-semibold">
                                                Average
                                            </th>
                                            <th className="w-24 py-2.5 pl-3 pr-5 text-right font-semibold">
                                                Best
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row) => {
                                            const isPodium =
                                                row.position !== null &&
                                                row.position <= 3;
                                            return (
                                                <tr
                                                    key={row.result.id}
                                                    className={cn(
                                                        "border-t",
                                                        isPodium &&
                                                            "bg-success-soft"
                                                    )}
                                                >
                                                    <td
                                                        className={cn(
                                                            "py-2.5 pl-5 pr-2",
                                                            isPodium
                                                                ? "font-bold text-success"
                                                                : "text-muted-foreground"
                                                        )}
                                                    >
                                                        {row.position}
                                                    </td>
                                                    <td className="px-3 py-2.5 font-semibold">
                                                        {row.result.person.name}
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        {row.result.person
                                                            .countryIso2 && (
                                                            <span className="flex items-center gap-2">
                                                                <FlagIcon
                                                                    country={
                                                                        row
                                                                            .result
                                                                            .person
                                                                            .countryIso2
                                                                    }
                                                                    size={16}
                                                                />
                                                                {regionNameByIso2(
                                                                    row.result
                                                                        .person
                                                                        .countryIso2
                                                                )}
                                                            </span>
                                                        )}
                                                    </td>
                                                    {Array.from(
                                                        { length: maxAttempts },
                                                        (_, i) => (
                                                            <td
                                                                key={i}
                                                                className="whitespace-nowrap px-2 py-2.5 text-right"
                                                            >
                                                                {row.submitted[
                                                                    i
                                                                ]
                                                                    ? attemptWithPenaltyToString(
                                                                          row
                                                                              .submitted[
                                                                              i
                                                                          ]
                                                                      )
                                                                    : ""}
                                                            </td>
                                                        )
                                                    )}
                                                    <td className="px-3 py-2.5 text-right font-bold">
                                                        {averageText(
                                                            row.average
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 pl-3 pr-5 text-right text-muted-foreground">
                                                        {bestText(row)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <ol className="flex flex-col divide-y min-[1120px]:hidden">
                                {rows.map((row) => {
                                    const isPodium =
                                        row.position !== null &&
                                        row.position <= 3;
                                    return (
                                        <li
                                            key={row.result.id}
                                            className={cn(
                                                "flex items-center gap-3 px-4 py-2.5",
                                                isPodium && "bg-success-soft"
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "w-6 text-sm",
                                                    isPodium
                                                        ? "font-bold text-success"
                                                        : "text-faint"
                                                )}
                                            >
                                                {row.position}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-semibold">
                                                    {row.result.person.name}
                                                </p>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {row.submitted
                                                        .map(
                                                            attemptWithPenaltyToString
                                                        )
                                                        .join("  ") ||
                                                        "No attempts yet"}
                                                </p>
                                            </div>
                                            <div className="text-right text-sm">
                                                <p className="font-bold">
                                                    {averageText(row.average)}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Best {bestText(row)}
                                                </p>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                        </>
                    )}
                </section>
            )}
        </div>
    );
};

export default PublicResultsBoard;
