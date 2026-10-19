import { Github, LogOut, Settings } from "lucide-react";
import { Link } from "react-router-dom";

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
} from "@/Components/ui/sheet";
import UserAvatar from "@/Components/UserAvatar";
import { useLogout } from "@/hooks/useLogout";
import { getUserInfo } from "@/lib/auth";
import { GITHUB_URL } from "@/lib/constants";
import { UserInfo } from "@/lib/interfaces";

import { getAccountDescription } from "./accountDescription";

interface MobileUserSheetProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    canAccessSettings: boolean;
}

const itemClassName =
    "flex h-[52px] items-center gap-3.5 rounded-chip px-3.5 text-[15px] transition-colors active:bg-accent [&>svg]:size-[22px] [&>svg]:text-muted-foreground";

const MobileUserSheet = ({
    isOpen,
    onOpenChange,
    canAccessSettings,
}: MobileUserSheetProps) => {
    const userInfo: UserInfo = getUserInfo();
    const handleLogout = useLogout();
    const close = () => onOpenChange(false);

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" hideClose className="gap-0 px-2 pt-3">
                <div className="mx-auto mb-2.5 h-1 w-9 rounded-full bg-border-strong" />
                <div className="flex items-center gap-3 px-3.5 pb-3.5 pt-1.5">
                    <UserAvatar
                        fullName={userInfo.fullName}
                        avatarUrl={userInfo.avatarUrl}
                        className="size-11"
                    />
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <SheetTitle className="truncate text-base font-semibold">
                            {userInfo.fullName}
                        </SheetTitle>
                        <SheetDescription className="text-[13px] text-muted-foreground">
                            {getAccountDescription(userInfo)}
                        </SheetDescription>
                    </div>
                </div>
                {canAccessSettings && (
                    <Link
                        to="/settings"
                        onClick={close}
                        className={itemClassName}
                    >
                        <Settings />
                        Settings
                    </Link>
                )}
                <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noreferrer"
                    className={itemClassName}
                >
                    <Github />
                    Source code
                </a>
                <button
                    onClick={() => {
                        close();
                        handleLogout();
                    }}
                    className={`${itemClassName} text-destructive [&>svg]:!text-destructive`}
                >
                    <LogOut />
                    Log out
                </button>
            </SheetContent>
        </Sheet>
    );
};

export default MobileUserSheet;
