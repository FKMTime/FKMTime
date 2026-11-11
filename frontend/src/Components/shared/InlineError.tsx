import { CircleAlert } from "lucide-react";
import { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface InlineErrorProps {
    children?: ReactNode;
    className?: string;
}

/**
 * Inline error box (login, import, unlock, card scans). Renders nothing
 * without a message, so callers can pass their error state directly.
 */
const InlineError = ({ children, className }: InlineErrorProps) => {
    if (!children) return null;
    return (
        <div
            role="alert"
            className={cn(
                "flex items-start gap-2.5 rounded-xl bg-destructive-soft px-3.5 py-3 text-sm font-medium text-destructive",
                className
            )}
        >
            <CircleAlert className="mt-px size-[18px] shrink-0" />
            <div>{children}</div>
        </div>
    );
};

export default InlineError;
