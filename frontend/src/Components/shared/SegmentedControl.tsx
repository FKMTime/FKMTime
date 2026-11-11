import { ReactNode } from "react";

import { useScrollFade } from "@/hooks/useScrollFade";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string = string> {
    value: T;
    label: ReactNode;
    /** Accessible name when the label is not plain text */
    ariaLabel?: string;
    /** Count shown as a red pill, e.g. open incidents per room */
    badge?: number;
}

interface SegmentedControlProps<T extends string> {
    options: SegmentedOption<T>[];
    value: T;
    onValueChange: (value: T) => void;
    label: string;
    /** Stretch segments to fill the track (mobile room switcher) */
    fullWidth?: boolean;
    className?: string;
}

/** Small filter switch: surface2 track with a raised selected segment */
const SegmentedControl = <T extends string>({
    options,
    value,
    onValueChange,
    label,
    fullWidth,
    className,
}: SegmentedControlProps<T>) => {
    const scrollRef = useScrollFade<HTMLDivElement>();
    return (
        <div
            ref={scrollRef}
            role="radiogroup"
            aria-label={label}
            className={cn(
                "flex gap-0.5 scroll-fade-x overflow-x-auto rounded-chip bg-secondary p-[3px] scrollbar-none",
                fullWidth ? "w-full" : "w-fit max-w-full",
                className
            )}
        >
            {options.map((option) => {
                const isSelected = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={option.ariaLabel}
                        onClick={() => onValueChange(option.value)}
                        className={cn(
                            "flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/40 md:h-8 md:text-[13px]",
                            fullWidth && "flex-1",
                            isSelected
                                ? "bg-card text-foreground shadow-segment"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {option.label}
                        {!!option.badge && (
                            <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive-soft px-1 text-[11px] font-bold text-destructive">
                                {option.badge}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default SegmentedControl;
