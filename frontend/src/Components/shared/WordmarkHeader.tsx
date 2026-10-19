import { ReactNode } from "react";

import ModeToggle from "@/Components/ModeToggle";
import { cn } from "@/lib/utils";

interface WordmarkHeaderProps {
    children?: ReactNode;
    className?: string;
}

/**
 * Top bar of the standalone pages (login, import, error): the FKMTime
 * wordmark on the left, optional actions and the theme toggle on the right.
 */
const WordmarkHeader = ({ children, className }: WordmarkHeaderProps) => (
    <header
        className={cn("flex items-center justify-between gap-3", className)}
    >
        <span className="text-lg font-bold tracking-[-0.01em]">FKMTime</span>
        <div className="flex items-center gap-2">
            {children}
            <ModeToggle />
        </div>
    </header>
);

export default WordmarkHeader;
