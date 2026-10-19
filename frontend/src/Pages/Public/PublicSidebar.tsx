import { LogIn } from "lucide-react";
import { Link, matchPath, useLocation } from "react-router-dom";

import { getEventIconClass } from "@/lib/events";
import { cn } from "@/lib/utils";

import {
    getActivePublicNavId,
    getShortRoundLabel,
    PUBLIC_NAV_ITEMS,
} from "./publicNavigation";

interface PublicSidebarProps {
    competitionName: string;
    /** Shown as sub-items under Results */
    liveRoundIds: string[];
}

const PublicSidebar = ({
    competitionName,
    liveRoundIds,
}: PublicSidebarProps) => {
    const { pathname } = useLocation();
    const activeId = getActivePublicNavId(pathname);
    const roundId = matchPath("/public/results/:id", pathname)?.params.id;

    return (
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-card min-[760px]:flex">
            <div className="border-b px-5 pb-4 pt-5">
                <div className="text-lg font-bold leading-tight">FKMTime</div>
                <div className="mt-0.5 truncate text-[13px] text-muted-foreground">
                    {competitionName}
                </div>
            </div>
            <nav
                aria-label="Public display"
                className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3"
            >
                <span className="px-2.5 pb-1.5 pt-1 text-xs font-semibold text-faint">
                    Public display
                </span>
                {PUBLIC_NAV_ITEMS.map(({ id, label, icon: Icon, to }) => {
                    const isActive = id === activeId;
                    const rounds = id === "results" ? liveRoundIds : [];
                    return (
                        <div key={id} className="flex flex-col gap-0.5">
                            <Link
                                to={to}
                                aria-current={
                                    isActive && !roundId ? "page" : undefined
                                }
                                className={cn(
                                    "flex h-[38px] items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
                                    isActive
                                        ? "bg-primary-soft font-semibold text-primary"
                                        : "font-medium text-foreground hover:bg-accent"
                                )}
                            >
                                <Icon
                                    className={cn(
                                        "size-5 shrink-0",
                                        isActive && "fill-primary/20"
                                    )}
                                    strokeWidth={isActive ? 2.25 : 2}
                                />
                                {label}
                            </Link>
                            {rounds.length > 0 && (
                                <div className="mb-1 ml-5 mt-0.5 flex flex-col gap-0.5 border-l pl-2.5">
                                    {rounds.map((liveRoundId) => {
                                        const isRoundActive =
                                            isActive && liveRoundId === roundId;
                                        return (
                                            <Link
                                                key={liveRoundId}
                                                to={`/public/results/${liveRoundId}`}
                                                aria-current={
                                                    isRoundActive
                                                        ? "page"
                                                        : undefined
                                                }
                                                className={cn(
                                                    "flex h-[34px] items-center gap-2 rounded-lg px-2.5 text-[13px] transition-colors",
                                                    isRoundActive
                                                        ? "bg-primary-soft font-semibold text-primary"
                                                        : "font-medium text-foreground hover:bg-accent"
                                                )}
                                            >
                                                <span
                                                    aria-hidden
                                                    className={cn(
                                                        "cubing-icon text-[15px]",
                                                        getEventIconClass(
                                                            liveRoundId.split(
                                                                "-"
                                                            )[0]
                                                        )
                                                    )}
                                                />
                                                {getShortRoundLabel(
                                                    liveRoundId
                                                )}
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </nav>
            <div className="border-t p-3">
                <Link
                    to="/auth/login"
                    className="flex h-[38px] items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                    <LogIn className="size-5 shrink-0" />
                    Staff sign in
                </Link>
            </div>
        </aside>
    );
};

export default PublicSidebar;
