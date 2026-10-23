import { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ToggleChipProps {
    pressed: boolean;
    onPressedChange: (pressed: boolean) => void;
    children: ReactNode;
    className?: string;
}

/** On/off filter pill, e.g. "Newcomers" */
const ToggleChip = ({
    pressed,
    onPressedChange,
    children,
    className,
}: ToggleChipProps) => (
    <button
        type="button"
        aria-pressed={pressed}
        onClick={() => onPressedChange(!pressed)}
        className={cn(
            "flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-chip border px-3 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 md:h-10",
            pressed
                ? "border-primary bg-primary-soft text-primary"
                : "bg-card text-foreground hover:bg-accent",
            className
        )}
    >
        {children}
    </button>
);

export default ToggleChip;
