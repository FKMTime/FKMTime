import { Search } from "lucide-react";
import { useState } from "react";
import { Event } from "wcif-helpers";

import { getEventIconClass, getEventName } from "@/lib/events";
import { roundName } from "@/lib/roundOptions";
import { cn } from "@/lib/utils";

import { StatusDot } from "./StatusBadge";

interface RoundGridProps {
    events: Event[];
    /** Marked with a dot, and opened when Enter picks an event */
    liveRoundIds: string[];
    /** Highlighted round id, or "" for none */
    value: string;
    onPick: (roundId: string) => void;
    /** Adds a first entry that picks "", e.g. "All rounds" */
    clearLabel?: string;
}

/** Every event with its rounds as a grid; typing narrows the events */
const RoundGrid = ({
    events,
    liveRoundIds,
    value,
    onPick,
    clearLabel,
}: RoundGridProps) => {
    const [query, setQuery] = useState("");

    const q = query.trim().toLowerCase();
    const matches = events.filter(
        (event) =>
            !q ||
            (getEventName(event.id) || event.id).toLowerCase().includes(q) ||
            event.id.includes(q)
    );
    const columns = Math.max(1, ...events.map((e) => e.rounds.length));

    // Enter opens the first matching event, on its live round if it has one
    const pickFirstMatch = () => {
        const event = matches[0];
        if (!event) return;
        const live = event.rounds.find((r) => liveRoundIds.includes(r.id));
        const target = live ?? event.rounds[0];
        if (target) onPick(target.id);
    };

    return (
        <>
            <label className="flex items-center gap-2 border-b p-2.5 pl-3.5">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        pickFirstMatch();
                    }}
                    placeholder="Type an event"
                    aria-label="Search events"
                    className="h-8 min-w-0 flex-1 bg-transparent text-base outline-hidden placeholder:text-faint md:text-sm"
                />
            </label>
            <div className="overflow-y-auto p-1.5">
                {clearLabel && !q && (
                    <button
                        type="button"
                        onClick={() => onPick("")}
                        aria-current={!value || undefined}
                        className={cn(
                            "mb-1 flex h-9 w-full items-center rounded-md px-2.5 text-[13px] font-semibold hover:bg-accent",
                            !value &&
                                "bg-primary-soft text-primary hover:bg-primary-soft"
                        )}
                    >
                        {clearLabel}
                    </button>
                )}
                <table className="w-full text-sm">
                    <tbody>
                        {matches.map((event) => (
                            <tr key={event.id}>
                                <th
                                    scope="row"
                                    className="py-0.5 pl-2.5 pr-4 text-left font-semibold"
                                >
                                    <span className="flex items-center gap-2 whitespace-nowrap">
                                        <span
                                            aria-hidden
                                            className={cn(
                                                "cubing-icon text-base",
                                                getEventIconClass(event.id)
                                            )}
                                        />
                                        {getEventName(event.id) || event.id}
                                    </span>
                                </th>
                                {Array.from({ length: columns }, (_, i) => {
                                    const round = event.rounds[i];
                                    if (!round) return <td key={i} />;
                                    const isLive = liveRoundIds.includes(
                                        round.id
                                    );
                                    const isSelected = round.id === value;
                                    return (
                                        <td key={i} className="py-0.5 pr-1">
                                            <button
                                                type="button"
                                                onClick={() => onPick(round.id)}
                                                aria-label={`${roundName(round.id)}${isLive ? ", live" : ""}`}
                                                aria-current={
                                                    isSelected || undefined
                                                }
                                                className={cn(
                                                    "flex h-9 w-full min-w-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[13px] font-semibold hover:bg-accent md:h-8",
                                                    isSelected &&
                                                        "bg-primary-soft text-primary hover:bg-primary-soft"
                                                )}
                                            >
                                                R{i + 1}
                                                {isLive && (
                                                    <StatusDot tone="primary" />
                                                )}
                                            </button>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {matches.length === 0 && (
                    <p className="p-6 text-center text-[13px] text-muted-foreground">
                        No events match
                    </p>
                )}
            </div>
        </>
    );
};

export default RoundGrid;
