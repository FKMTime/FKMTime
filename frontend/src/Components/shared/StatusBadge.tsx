import { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { STATUS_DOT, STATUS_SOFT, STATUS_TEXT, StatusTone } from "./status";

interface StatusBadgeProps {
    tone: StatusTone;
    children: ReactNode;
    /** Leading dot, e.g. for live rounds */
    withDot?: boolean;
    className?: string;
}

/** Soft pill for short statuses: "+4 min", "Resolved", "Incident" */
export const StatusBadge = ({
    tone,
    children,
    withDot,
    className,
}: StatusBadgeProps) => (
    <span
        className={cn(
            "inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-semibold [&>svg]:size-3.5",
            STATUS_SOFT[tone],
            className
        )}
    >
        {withDot && <StatusDot tone={tone} />}
        {children}
    </span>
);

interface StatusDotProps {
    tone: StatusTone;
    className?: string;
}

export const StatusDot = ({ tone, className }: StatusDotProps) => (
    <span
        aria-hidden
        className={cn(
            "inline-block size-1.5 shrink-0 rounded-full",
            STATUS_DOT[tone],
            className
        )}
    />
);

interface StatusLabelProps {
    tone: StatusTone;
    children: ReactNode;
    icon?: ReactNode;
    className?: string;
}

/** Uppercase coloured label, e.g. "SOLVING" on a station card */
export const StatusLabel = ({
    tone,
    children,
    icon,
    className,
}: StatusLabelProps) => (
    <span
        className={cn(
            "inline-flex items-center gap-1 text-2xs font-bold uppercase [&>svg]:size-[15px]",
            STATUS_TEXT[tone],
            className
        )}
    >
        {icon}
        {children}
    </span>
);
