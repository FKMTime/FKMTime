import { Link, useLocation } from "react-router-dom";

import { cn } from "@/lib/utils";

import { getActivePublicNavId, getPublicNavItems } from "./publicNavigation";

interface PublicTabsProps {
    /** Head-to-head rounds, each with a Bracket tab */
    h2hRoundIds?: string[];
}

/** Below 760px the sidebar becomes these tabs under the header */
const PublicTabs = ({ h2hRoundIds = [] }: PublicTabsProps) => {
    const activeId = getActivePublicNavId(useLocation().pathname);

    return (
        <nav
            aria-label="Public display"
            className="flex gap-0.5 overflow-x-auto px-3 [scrollbar-width:none] min-[760px]:hidden"
        >
            {getPublicNavItems(h2hRoundIds).map(
                ({ id, label, icon: Icon, to }) => {
                    const isActive = id === activeId;
                    return (
                        <Link
                            key={id}
                            to={to}
                            aria-current={isActive ? "page" : undefined}
                            className={cn(
                                // At least as wide as their label: with several
                                // brackets, the tabs scroll instead of crowding
                                "-mb-px flex h-11 flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-2 text-sm font-semibold",
                                isActive
                                    ? "border-primary text-foreground"
                                    : "border-transparent text-muted-foreground"
                            )}
                        >
                            <Icon className="size-[19px]" />
                            {label}
                        </Link>
                    );
                }
            )}
        </nav>
    );
};

export default PublicTabs;
