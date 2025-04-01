import { Link, useNavigate } from "react-router-dom";
import { startTransition } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { Button } from "@/Components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { useToast } from "@/hooks/useToast";
import { getUserInfo, logout } from "@/lib/auth";
import { isDelegate } from "@/lib/permissions";
import { loggedInWithWca } from "@/lib/utils";

const ProfileDropdown = () => {
    const { toast } = useToast();
    const navigate = useNavigate();
    const userInfo = getUserInfo();

    const handleLogout = () => {
        logout();
        toast({
            title: "Logged out",
            description: "You have been logged out.",
            variant: "success",
        });
        navigate("/auth/login");
    };

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    className="relative h-8 w-8 rounded-full"
                >
                    <Avatar className="h-8 w-8">
                        <AvatarImage
                            src={userInfo.avatarUrl}
                            alt={userInfo.fullName}
                        />
                        <AvatarFallback>{userInfo.fullName[0]}</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                            {userInfo.fullName}
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(isDelegate() || !loggedInWithWca()) && (
                    <DropdownMenuGroup>
                        <DropdownMenuItem asChild>
                            <Link to="/settings">Settings</Link>
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                )}
                <DropdownMenuItem onClick={handleLogout}>
                    Log out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default ProfileDropdown;
