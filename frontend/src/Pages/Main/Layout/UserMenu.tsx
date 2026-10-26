import { Github, LogOut, Settings } from "lucide-react";
import { Link } from "react-router-dom";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import UserAvatar from "@/Components/UserAvatar";
import { useLogout } from "@/hooks/useLogout";
import { getUserInfo } from "@/lib/auth";
import { GITHUB_URL } from "@/lib/constants";
import { UserInfo } from "@/lib/interfaces";

import { getAccountDescription } from "./accountDescription";

interface UserMenuProps {
    canAccessSettings: boolean;
}

const UserMenu = ({ canAccessSettings }: UserMenuProps) => {
    const userInfo: UserInfo = getUserInfo();
    const handleLogout = useLogout();

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger
                className="rounded-full transition-shadow hover:ring-2 hover:ring-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Account"
            >
                <UserAvatar
                    fullName={userInfo.fullName}
                    avatarUrl={userInfo.avatarUrl}
                    className="size-[38px]"
                />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[230px]">
                <DropdownMenuLabel className="flex flex-col gap-0.5 px-2.5 pb-2.5 pt-2 text-sm text-foreground">
                    <span className="font-semibold">{userInfo.fullName}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                        {getAccountDescription(userInfo)}
                    </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {canAccessSettings && (
                    <DropdownMenuItem asChild>
                        <Link to="/settings">
                            <Settings />
                            Settings
                        </Link>
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                    <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                        <Github />
                        Source code
                    </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive focus:text-destructive [&>svg]:text-destructive!"
                >
                    <LogOut />
                    Log out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default UserMenu;
