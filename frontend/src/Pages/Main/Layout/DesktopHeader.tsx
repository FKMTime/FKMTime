import { Plus } from "lucide-react";

import ModeToggle from "@/Components/ModeToggle";
import ConnectionStatus from "@/Components/shared/ConnectionStatus";
import { Button } from "@/Components/ui/button";
import { Crumb } from "@/lib/navigation";

import Breadcrumbs from "./Breadcrumbs";
import CompetitorSearch from "./CompetitorSearch";
import UserMenu from "./UserMenu";

interface DesktopHeaderProps {
    crumbs: Crumb[];
    canEnterAttempts: boolean;
    canAccessSettings: boolean;
    onEnterAttempt: () => void;
}

const DesktopHeader = ({
    crumbs,
    canEnterAttempts,
    canAccessSettings,
    onEnterAttempt,
}: DesktopHeaderProps) => (
    <header className="sticky top-0 z-30 hidden h-16 shrink-0 items-center justify-between gap-4 border-b bg-background/95 px-8 backdrop-blur md:flex">
        <div className="min-w-0">
            <Breadcrumbs crumbs={crumbs} />
        </div>
        <div className="flex min-w-0 items-center gap-2">
            <ConnectionStatus />
            <CompetitorSearch />
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
