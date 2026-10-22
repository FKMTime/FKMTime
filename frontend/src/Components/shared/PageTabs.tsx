import { Link } from "react-router-dom";

import { useScrollFade } from "@/hooks/useScrollFade";
import { cn } from "@/lib/utils";

export interface PageTab<T extends string = string> {
    value: T;
    label: string;
    count?: number;
    /** Route tabs render as links; omit for in-page tabs */
    to?: string;
}

interface PageTabsProps<T extends string> {
    tabs: PageTab<T>[];
    value: T;
    onValueChange?: (value: T) => void;
    label: string;
    className?: string;
}

/** Underline tabs (2px primary) for page sections */
const PageTabs = <T extends string>({
    tabs,
    value,
    onValueChange,
    label,
    className,
}: PageTabsProps<T>) => {
    const scrollRef = useScrollFade<HTMLDivElement>();
    return (
        <div
            ref={scrollRef}
            role="tablist"
            aria-label={label}
            className={cn(
                "-mx-4 flex gap-0.5 scroll-fade-x overflow-x-auto border-b px-2 [scrollbar-width:none] md:mx-0 md:gap-1 md:px-0",
                className
            )}
        >
            {tabs.map((tab) => {
                const isActive = tab.value === value;
                const tabClassName = cn(
                    "-mb-px flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 md:h-10",
                    isActive
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                );
                const content = (
                    <>
                        {tab.label}
                        {tab.count !== undefined && (
                            <span className="text-xs font-semibold text-faint">
                                {tab.count}
                            </span>
                        )}
                    </>
                );
                const common = {
                    role: "tab",
                    "aria-selected": isActive,
                    className: tabClassName,
                } as const;
                return tab.to ? (
                    <Link
                        key={tab.value}
                        to={tab.to}
                        onClick={() => onValueChange?.(tab.value)}
                        {...common}
                    >
                        {content}
                    </Link>
                ) : (
                    <button
                        key={tab.value}
                        type="button"
                        onClick={() => onValueChange?.(tab.value)}
                        {...common}
                    >
                        {content}
                    </button>
                );
            })}
        </div>
    );
};

export default PageTabs;
