import { ChevronDown, Search } from "lucide-react";
import { useState } from "react";
import { Event } from "wcif-helpers";

import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/Components/ui/popover";
import { getEventIconClass } from "@/lib/events";
import { roundName } from "@/lib/roundOptions";
import { cn, shortRoundName } from "@/lib/utils";

import RoundGrid from "./RoundGrid";

interface RoundFinderProps {
    events: Event[];
    liveRoundIds: string[];
    /** Selected round id, or "" for none */
    value: string;
    onValueChange: (roundId: string) => void;
    /** Adds a first entry that clears the round, e.g. "All rounds" */
    clearLabel?: string;
    /** Short trigger ("3x3 R1") beside the schedule, full name otherwise */
    compact?: boolean;
    className?: string;
}

/** A button showing the round; opens every event with its rounds */
const RoundFinder = ({
    events,
    liveRoundIds,
    value,
    onValueChange,
    clearLabel,
    compact,
    className,
}: RoundFinderProps) => {
    const [isOpen, setIsOpen] = useState(false);

    const pick = (roundId: string) => {
        setIsOpen(false);
        onValueChange(roundId);
    };

    const eventId = value ? value.split("-")[0] : "";
    const label = value
        ? compact
            ? shortRoundName(value)
            : roundName(value)
        : clearLabel ?? "Choose a round";

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={`Find a round, now ${value ? roundName(value) : label}`}
                    className={cn(
                        "flex h-14 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl border bg-card px-3.5 text-left text-sm font-bold transition-colors hover:border-border-strong focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/40",
                        isOpen && "border-border-strong",
                        !compact && "h-11 w-full font-semibold md:h-10",
                        className
                    )}
                >
                    {eventId ? (
                        <span
                            aria-hidden
                            className={cn(
                                "cubing-icon text-lg",
                                getEventIconClass(eventId)
                            )}
                        />
                    ) : (
                        <Search className="size-4 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                className="flex max-h-[min(520px,var(--radix-popover-content-available-height))] w-auto min-w-[380px] flex-col overflow-hidden rounded-mobile-card p-0"
            >
                <RoundGrid
                    events={events}
                    liveRoundIds={liveRoundIds}
                    value={value}
                    onPick={pick}
                    clearLabel={clearLabel}
                />
            </PopoverContent>
        </Popover>
    );
};

export default RoundFinder;
