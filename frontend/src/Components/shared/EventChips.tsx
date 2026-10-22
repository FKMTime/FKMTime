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

/** Event picker: scrolls horizontally on mobile, wraps on wider screens */
const EventChips = ({
    events,
    value,
    onValueChange,
    className,
}: EventChipsProps) => {
    const scrollRef = useScrollFade<HTMLDivElement>();
    return (
        <div
            ref={scrollRef}
            role="radiogroup"
            aria-label="Event"
            className={cn(
                "-mx-4 flex gap-1.5 scroll-fade-x overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0",
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
                            "flex h-11 shrink-0 items-center gap-[7px] whitespace-nowrap rounded-chip border px-3 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 md:h-10",
                            isSelected
                                ? "border-primary bg-primary-soft text-primary"
                                : "bg-card text-foreground hover:bg-accent"
                        )}
                    >
                        <span
                            aria-hidden
                            className={cn(
                                "cubing-icon text-lg",
                                getEventIconClass(event.id)
                            )}
                        />
                        {event.label}
                        {event.live && <StatusDot tone="primary" />}
                    </button>
                );
            })}
        </div>
    );
};

export default EventChips;
