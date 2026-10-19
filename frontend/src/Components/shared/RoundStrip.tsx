import { Check, List, Search } from "lucide-react";
import { ReactNode, useMemo, useState } from "react";

import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/Components/ui/popover";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
} from "@/Components/ui/sheet";
import { useIsMobile } from "@/hooks/useMobile";
import { getEventIconClass } from "@/lib/events";
import { RoundOption } from "@/lib/roundOptions";
import { cn } from "@/lib/utils";

import { StatusDot } from "./StatusBadge";

interface RoundStripProps {
    /** Rounds shown in the strip: usually the selected one plus live ones */
    rounds: RoundOption[];
    /** Every round, offered in the "All rounds" picker */
    allRounds: RoundOption[];
    value?: string;
    /** Selected round in the picker when the strip holds groups, not rounds */
    allRoundsValue?: string;
    onValueChange: (roundId: string) => void;
    /** Subtitle for rounds that are not live, e.g. "12 results" */
    getSubtitle?: (round: RoundOption) => ReactNode;
    className?: string;
}

/** Current and live rounds as quick switches, plus the full round list */
const RoundStrip = ({
    rounds,
    allRounds,
    value,
    allRoundsValue = value,
    onValueChange,
    getSubtitle,
    className,
}: RoundStripProps) => (
    <div className={cn("flex items-stretch gap-2", className)}>
        <div
            role="radiogroup"
            aria-label="Current rounds"
            className="flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-xl bg-secondary p-1 [scrollbar-width:none]"
        >
            {rounds.map((round) => {
                const isSelected = round.id === value;
                return (
                    <button
                        key={round.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        title={round.name}
                        onClick={() => onValueChange(round.id)}
                        className={cn(
                            "flex h-14 min-w-[150px] shrink-0 flex-col items-start justify-center gap-[3px] whitespace-nowrap rounded-[9px] px-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                            isSelected
                                ? "bg-card text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
                                : "text-muted-foreground hover:bg-accent"
                        )}
                    >
                        <span className="flex items-center gap-[7px] text-sm font-bold">
                            <span
                                aria-hidden
                                className={cn(
                                    "cubing-icon text-base",
                                    getEventIconClass(round.eventId)
                                )}
                            />
                            {round.label}
                        </span>
                        <RoundSubtitle
                            round={round}
                            getSubtitle={getSubtitle}
                        />
                    </button>
                );
            })}
        </div>
        <AllRoundsPicker
            rounds={allRounds}
            value={allRoundsValue}
            onValueChange={onValueChange}
            getSubtitle={getSubtitle}
        />
    </div>
);

interface RoundSubtitleProps {
    round: RoundOption;
    getSubtitle?: (round: RoundOption) => ReactNode;
}

const RoundSubtitle = ({ round, getSubtitle }: RoundSubtitleProps) => (
    <span
        className={cn(
            "flex min-w-0 items-center gap-[5px] text-xs font-semibold",
            round.isLive ? "text-primary" : "text-faint"
        )}
    >
        {round.isLive && <StatusDot tone="primary" />}
        <span className="truncate">
            {round.isLive ? round.liveRooms.join(", ") : getSubtitle?.(round)}
        </span>
    </span>
);

interface AllRoundsPickerProps {
    rounds: RoundOption[];
    value?: string;
    onValueChange: (roundId: string) => void;
    getSubtitle?: (round: RoundOption) => ReactNode;
}

export const AllRoundsPicker = ({
    rounds,
    value,
    onValueChange,
    getSubtitle,
}: AllRoundsPickerProps) => {
    const isMobile = useIsMobile();
    const [isOpen, setIsOpen] = useState(false);

    const select = (roundId: string) => {
        setIsOpen(false);
        onValueChange(roundId);
    };

    const trigger = (
        <button
            type="button"
            aria-label={`All rounds (${rounds.length})`}
            onClick={isMobile ? () => setIsOpen(true) : undefined}
            className={cn(
                "flex h-16 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border bg-card px-3.5 text-sm font-semibold transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 md:px-4",
                isOpen && "border-border-strong"
            )}
        >
            <List className="size-5" />
            <span className="hidden sm:inline">All rounds</span>
            <span className="text-xs text-muted-foreground">
                {rounds.length}
            </span>
        </button>
    );

    const list = (
        <RoundList
            rounds={rounds}
            value={value}
            onSelect={select}
            getSubtitle={getSubtitle}
        />
    );

    if (isMobile)
        return (
            <>
                {trigger}
                <Sheet open={isOpen} onOpenChange={setIsOpen}>
                    <SheetContent
                        side="bottom"
                        className="flex h-[85dvh] flex-col gap-0 p-0 pb-[env(safe-area-inset-bottom)]"
                    >
                        <SheetTitle className="px-5 pb-2 pt-5 text-base font-semibold">
                            All rounds
                        </SheetTitle>
                        <SheetDescription className="sr-only">
                            Pick a round to show
                        </SheetDescription>
                        {list}
                    </SheetContent>
                </Sheet>
            </>
        );

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverContent
                align="end"
                className="flex max-h-[480px] w-[460px] flex-col overflow-hidden rounded-[14px] p-0"
            >
                {list}
            </PopoverContent>
        </Popover>
    );
};

interface RoundListProps {
    rounds: RoundOption[];
    value?: string;
    onSelect: (roundId: string) => void;
    getSubtitle?: (round: RoundOption) => ReactNode;
}

const RoundList = ({
    rounds,
    value,
    onSelect,
    getSubtitle,
}: RoundListProps) => {
    const [query, setQuery] = useState("");

    const groups = useMemo(() => {
        const q = query.trim().toLowerCase();
        const matches = rounds.filter(
            (round) =>
                !q ||
                round.name.toLowerCase().includes(q) ||
                round.label.toLowerCase().includes(q)
        );
        const byEvent = new Map<string, RoundOption[]>();
        for (const round of matches) {
            byEvent.set(round.eventId, [
                ...(byEvent.get(round.eventId) ?? []),
                round,
            ]);
        }
        return [...byEvent.values()];
    }, [rounds, query]);

    return (
        <>
            <label className="flex items-center gap-2 border-b p-2.5 pl-3.5">
                <Search className="size-5 shrink-0 text-muted-foreground" />
                <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search rounds"
                    aria-label="Search rounds"
                    className="h-9 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-faint md:text-sm"
                />
            </label>
            <div className="flex flex-col gap-0.5 overflow-y-auto p-1.5">
                {groups.map((group) => (
                    <div
                        key={group[0].eventId}
                        className="flex flex-col gap-0.5"
                    >
                        <div className="flex items-center gap-2 px-3 pb-1 pt-2.5 text-xs font-bold text-muted-foreground">
                            <span
                                aria-hidden
                                className={cn(
                                    "cubing-icon text-base text-foreground",
                                    getEventIconClass(group[0].eventId)
                                )}
                            />
                            {group[0].eventName}
                        </div>
                        {group.map((round) => {
                            const isSelected = round.id === value;
                            return (
                                <button
                                    key={round.id}
                                    type="button"
                                    onClick={() => onSelect(round.id)}
                                    aria-current={isSelected || undefined}
                                    className={cn(
                                        "flex min-h-11 items-center gap-3 rounded-lg py-2 pl-9 pr-3 text-left hover:bg-accent",
                                        isSelected &&
                                            "bg-primary-soft hover:bg-primary-soft"
                                    )}
                                >
                                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                        <span className="truncate text-sm font-semibold">
                                            {round.name}
                                        </span>
                                        <RoundSubtitle
                                            round={round}
                                            getSubtitle={getSubtitle}
                                        />
                                    </span>
                                    {isSelected && (
                                        <Check className="size-5 shrink-0 text-primary" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                ))}
                {groups.length === 0 && (
                    <p className="p-6 text-center text-[13px] text-muted-foreground">
                        No rounds match
                    </p>
                )}
            </div>
        </>
    );
};

export default RoundStrip;
