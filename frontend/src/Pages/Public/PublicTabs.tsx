import { Link, useLocation } from "react-router-dom";

import { cn } from "@/lib/utils";

import { getActivePublicNavId, PUBLIC_NAV_ITEMS } from "./publicNavigation";

/** Below 760px the sidebar becomes these two tabs under the header */
const PublicTabs = () => {
    const activeId = getActivePublicNavId(useLocation().pathname);

    return (
        <nav
            aria-label="Public display"
            className="flex gap-0.5 px-3 min-[760px]:hidden"
        >
            {PUBLIC_NAV_ITEMS.map(({ id, label, icon: Icon, to }) => {
                const isActive = id === activeId;
                return (
                    <Link
                        key={id}
                        to={to}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                            "-mb-px flex h-11 flex-1 items-center justify-center gap-1.5 border-b-2 text-sm font-semibold",
                            isActive
                                ? "border-primary text-foreground"
                                : "border-transparent text-muted-foreground"
                        )}
                    >
                        <Icon className="size-[19px]" />
                        {label}
                    </Link>
                );
            })}
        </nav>
    );
};

export default PublicTabs;
