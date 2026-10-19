import { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
    children: ReactNode;
    icon?: ReactNode;
    action?: ReactNode;
    className?: string;
}

/** Dashed placeholder for "nothing here yet" and "select something" states */
const EmptyState = ({ children, icon, action, className }: EmptyStateProps) => (
    <div
        className={cn(
            "flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-mobile-card border border-dashed p-8 text-center text-sm text-muted-foreground md:rounded-2xl",
            className
        )}
    >
        {icon && (
            <span className="text-faint [&>svg]:size-8" aria-hidden>
                {icon}
            </span>
        )}
        <div>{children}</div>
        {action}
    </div>
);

export default EmptyState;
