import { Link } from "react-router-dom";

import FkmLogo from "@/Components/shared/FkmLogo";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/Components/ui/tooltip";
import { NavGroup, NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface DesktopSidebarProps {
    competitionName: string;
    items: NavItem[];
    activeItem?: NavItem;
    unresolvedIncidentsCount: number;
}

// Settings lives in the user menu on desktop
const SIDEBAR_GROUPS: NavGroup[] = ["Competition day", "Admin"];

/**
 * 240px sidebar from lg up; between md and lg it collapses to icons with
 * tooltips. Hidden below md, where the mobile shell takes over.
 */
const DesktopSidebar = ({
    competitionName,
    items,
    activeItem,
    unresolvedIncidentsCount,
}: DesktopSidebarProps) => (
    <aside className="sticky top-0 hidden h-dvh w-16 shrink-0 flex-col border-r bg-card md:flex lg:w-60">
        <div className="flex min-h-[73px] shrink-0 items-center justify-center border-b px-3 lg:flex-col lg:gap-2 lg:px-4 lg:py-4">
            <FkmLogo variant="mark" className="h-10 lg:hidden" />
            <FkmLogo className="hidden h-auto w-full lg:block" />
            <span
                title={competitionName}
                className="hidden w-full text-center text-[13px] text-muted-foreground lg:line-clamp-2"
            >
                {competitionName}
            </span>
        </div>
        <TooltipProvider delayDuration={200}>
            <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-2.5 py-4 lg:px-3">
                {SIDEBAR_GROUPS.map((group, index) => {
                    const groupItems = items.filter((i) => i.group === group);
                    if (groupItems.length === 0) return null;
                    return (
                        <div key={group} className="flex flex-col gap-0.5">
                            <span className="hidden px-2.5 pb-1.5 text-xs font-medium text-faint lg:block">
                                {group}
                            </span>
                            {index > 0 && (
                                <div className="mx-2 mb-1.5 h-px bg-border lg:hidden" />
                            )}
                            {groupItems.map((item) => (
                                <SidebarLink
                                    key={item.id}
                                    item={item}
                                    isActive={item.id === activeItem?.id}
                                    badge={
                                        item.id === "incidents"
                                            ? unresolvedIncidentsCount
                                            : 0
                                    }
                                />
                            ))}
                        </div>
                    );
                })}
            </nav>
        </TooltipProvider>
    </aside>
);

interface SidebarLinkProps {
    item: NavItem;
    isActive: boolean;
    badge: number;
}

const SidebarLink = ({ item, isActive, badge }: SidebarLinkProps) => {
    const Icon = item.icon;
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Link
                    to={item.to}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                        "relative flex h-10 items-center justify-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-colors lg:justify-start",
                        isActive
                            ? "bg-primary-soft text-primary"
                            : "text-foreground hover:bg-accent"
                    )}
                >
                    <Icon
                        className={cn(
                            "size-5 shrink-0",
                            isActive && "fill-primary/20"
                        )}
                        strokeWidth={isActive ? 2.25 : 2}
                    />
                    <span className="hidden flex-1 truncate lg:block">
                        {item.label}
                    </span>
                    {badge > 0 && (
                        <>
                            <span className="hidden min-w-6 rounded-full bg-destructive-soft px-1.5 text-center text-xs font-bold leading-6 text-destructive lg:block">
                                {badge}
                            </span>
                            <span
                                className="absolute right-2 top-1.5 size-2 rounded-full bg-destructive lg:hidden"
                                aria-label={`${badge} open`}
                            />
                        </>
                    )}
                </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="lg:hidden">
                {item.label}
                {badge > 0 ? ` · ${badge}` : ""}
            </TooltipContent>
        </Tooltip>
    );
};

export default DesktopSidebar;
