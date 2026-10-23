import { ChevronRight, Plus } from "lucide-react";
import { Link } from "react-router-dom";

import ModeToggle from "@/Components/ModeToggle";
import ConnectionStatus from "@/Components/shared/ConnectionStatus";
import { Button } from "@/Components/ui/button";
import { Crumb } from "@/lib/navigation";

import Breadcrumbs from "./Breadcrumbs";
import GlobalSearch from "./GlobalSearch";
import UserMenu from "./UserMenu";

interface DesktopHeaderProps {
    competitionName: string;
    crumbs: Crumb[];
    canEnterAttempts: boolean;
    canAccessSettings: boolean;
    onEnterAttempt: () => void;
}

const DesktopHeader = ({
    competitionName,
    crumbs,
    canEnterAttempts,
    canAccessSettings,
    onEnterAttempt,
}: DesktopHeaderProps) => (
    <header className="sticky top-0 z-30 hidden h-16 shrink-0 items-center justify-between gap-4 border-b bg-background/95 px-8 backdrop-blur md:flex">
        {/* The competition leads the breadcrumbs and links home; with no
            crumbs (Home) it is the heading itself */}
        <div className="flex min-w-0 items-center gap-1">
            {crumbs.length > 0 ? (
                <>
                    <Link
                        to="/"
                        title={competitionName}
                        className="-ml-1.5 min-w-0 max-w-[18rem] shrink truncate rounded-md px-1.5 py-1 text-[15px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                        {competitionName}
                    </Link>
                    <ChevronRight className="size-4 shrink-0 text-faint" />
                    <Breadcrumbs crumbs={crumbs} />
                </>
            ) : (
                <h1 className="min-w-0 truncate text-[15px] font-semibold">
                    {competitionName}
                </h1>
            )}
        </div>
        <div className="flex min-w-0 items-center gap-2">
            <ConnectionStatus />
            <GlobalSearch />
            {canEnterAttempts && (
                <Button
                    onClick={onEnterAttempt}
                    aria-label="Enter attempt"
                    className="h-[38px] shrink-0 md:h-[38px]"
                >
                    <Plus />
                    <span className="hidden lg:inline">Enter attempt</span>
                </Button>
            )}
            <ModeToggle />
            <UserMenu canAccessSettings={canAccessSettings} />
        </div>
    </header>
);

export default DesktopHeader;
