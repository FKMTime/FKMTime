import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import { useIsMobile } from "@/hooks/useMobile";
import { useScrollFade } from "@/hooks/useScrollFade";
import { getEventIconClass } from "@/lib/events";
import { cn } from "@/lib/utils";

import { StatusDot } from "./StatusBadge";

export interface EventChip {
    id: string;
    /** Short label, e.g. "3x3" */
    label: string;
    /** Full name for the tooltip and screen readers */
    name: string;
    /** Has a round in progress */
    live?: boolean;
}

interface EventChipsProps {
    events: EventChip[];
    value: string;
    onValueChange: (eventId: string) => void;
    className?: string;
}

/** Event picker: chips that wrap on wider screens, a dropdown on phones */
const EventChips = ({
    events,
    value,
    onValueChange,
    className,
}: EventChipsProps) => {
    const scrollRef = useScrollFade<HTMLDivElement>();
    const isMobile = useIsMobile();
    // A row of chips is too long to scan on a phone
    if (isMobile)
        return (
            <EventSelect
                events={events}
                value={value}
                onValueChange={onValueChange}
                className={className}
            />
        );
    return (
        <div
            ref={scrollRef}
            role="radiogroup"
            aria-label="Event"
            className={cn(
                "-mx-4 flex gap-1.5 scroll-fade-x overflow-x-auto px-4 scrollbar-none md:mx-0 md:flex-wrap md:px-0",
                className
            )}
        >
            {events.map((event) => {
                const isSelected = event.id === value;
                return (
                    <button
                        key={event.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={
                            event.live ? `${event.name}, live` : event.name
                        }
                        title={event.name}
                        onClick={() => onValueChange(event.id)}
                        className={cn(
                            "flex h-11 shrink-0 items-center gap-[7px] whitespace-nowrap rounded-chip border px-3 text-[13px] font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/40 md:h-10",
                            isSelected
                                ? "border-primary bg-primary-soft text-primary"
                                : "bg-card text-foreground hover:bg-accent"
                        )}
                    >
                        {/* An empty id is a "no event" chip, e.g. "All rounds" */}
                        {event.id && (
                            <span
                                aria-hidden
                                className={cn(
                                    "cubing-icon text-lg",
                                    getEventIconClass(event.id)
                                )}
                            />
                        )}
                        {event.label}
                        {event.live && <StatusDot tone="primary" />}
                    </button>
                );
            })}
        </div>
    );
};

// Radix Select items can't have an empty value, which the "no event" chip uses
const NO_EVENT = "__none__";

const EventSelect = ({
    events,
    value,
    onValueChange,
    className,
}: EventChipsProps) => (
    <Select
        value={
            events.some((event) => event.id === value)
                ? value || NO_EVENT
                : undefined
        }
        onValueChange={(id) => onValueChange(id === NO_EVENT ? "" : id)}
    >
        <SelectTrigger aria-label="Event" className={cn("h-12", className)}>
            <SelectValue placeholder="Choose an event" />
        </SelectTrigger>
        <SelectContent>
            {events.map((event) => (
                <SelectItem
                    key={event.id || NO_EVENT}
                    value={event.id || NO_EVENT}
                    aria-label={event.live ? `${event.name}, live` : event.name}
                >
                    <span className="flex items-center gap-2.5">
                        {event.id && (
                            <span
                                aria-hidden
                                className={cn(
                                    "cubing-icon text-lg",
                                    getEventIconClass(event.id)
                                )}
                            />
                        )}
                        {event.name}
                        {event.live && <StatusDot tone="primary" />}
                    </span>
                </SelectItem>
            ))}
        </SelectContent>
    </Select>
);

export default EventChips;
