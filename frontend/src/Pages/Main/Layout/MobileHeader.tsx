import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import ModeToggle from "@/Components/ModeToggle";
import ConnectionStatus from "@/Components/shared/ConnectionStatus";
import UserAvatar from "@/Components/UserAvatar";
import { getUserInfo } from "@/lib/auth";
import { UserInfo } from "@/lib/interfaces";

import MobileUserSheet from "./MobileUserSheet";

interface MobileHeaderProps {
    title: string;
    subtitle?: string;
    backTo: string | null;
    canAccessSettings: boolean;
}

const MobileHeader = ({
    title,
    subtitle,
    backTo,
    canAccessSettings,
}: MobileHeaderProps) => {
    const navigate = useNavigate();
    const userInfo: UserInfo = getUserInfo();
    const [isUserSheetOpen, setIsUserSheetOpen] = useState(false);

    return (
        <header className="sticky top-0 z-30 border-b bg-card px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.25rem)] md:hidden">
            <div className="flex min-h-12 items-center gap-1">
                {backTo && (
                    <button
                        onClick={() => navigate(backTo)}
                        aria-label="Back"
                        className="-ml-1.5 flex size-11 shrink-0 items-center justify-center rounded-chip active:bg-accent"
                    >
                        <ArrowLeft className="size-6" />
                    </button>
                )}
                <div className="min-w-0 flex-1 pl-1">
                    <div className="truncate text-lg font-bold">{title}</div>
                    {subtitle && (
                        <div className="mt-px truncate text-[13px] text-muted-foreground">
                            {subtitle}
                        </div>
                    )}
                </div>
                <ConnectionStatus />
                <ModeToggle variant="ghost" className="size-11 rounded-chip" />
                <button
                    onClick={() => setIsUserSheetOpen(true)}
                    aria-label="Account"
                    className="flex size-11 shrink-0 items-center justify-center"
                >
                    <UserAvatar
                        fullName={userInfo.fullName}
                        avatarUrl={userInfo.avatarUrl}
                    />
                </button>
            </div>
            <MobileUserSheet
                isOpen={isUserSheetOpen}
                onOpenChange={setIsUserSheetOpen}
                canAccessSettings={canAccessSettings}
            />
        </header>
    );
};

export default MobileHeader;
