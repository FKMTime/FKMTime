import {
    AlarmClock,
    Bell,
    BookCheck,
    ClipboardList,
    House,
    Microchip,
    Puzzle,
    Settings,
    SquareCheckBig,
    TriangleAlert,
    Trophy,
    UserCog,
    Users,
} from "lucide-react";

import github from "@/assets/github.svg";
import logo from "@/assets/logo.svg";
import Avatar from "@/Components/Avatar/Avatar";
import { Button } from "@/Components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { isAdmin } from "@/lib/auth";
import { GITHUB_URL } from "@/lib/constants";
import { Competition, INotification, UserInfo } from "@/lib/interfaces";
import { cn } from "@/lib/utils";

import SidebarElement from "./SidebarElement";

interface SidebarContentProps {
    user: UserInfo;
    competition: Competition;
    handleLogout: () => void;
    onElementClick?: () => void;
    onClickNotifications: () => void;
    notifications: INotification[];
}

const SidebarContent = ({
    user,
    handleLogout,
    onElementClick,
    onClickNotifications,
    notifications,
}: SidebarContentProps) => {
    return (
        <div className="w-64 overflow-y-auto flex flex-col gap-5 items-center p-5 h-screen">
            <img src={logo} alt="Logo" width="100%" />
            <div className="flex items-center justify-center w-full rounded-md p-2 gap-5 text-center">
                <DropdownMenu>
                    <DropdownMenuTrigger>
                        <Avatar
                            avatarUrl={user.avatarUrl}
                            username={
                                user.fullName ? user.fullName : user.username
                            }
                        />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onClick={handleLogout}>
                            Logout
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className={cn("relative", isAdmin() ? "block" : "hidden")}>
                    <Button
                        size="icon"
                        variant="ghost"
                        className={
                            notifications.length > 0 ? "cursor-pointer" : ""
                        }
                        onClick={onClickNotifications}
                    >
                        <>
                            <Bell size={32} />
                            <div className="absolute -top-3 -right-3">
                                <p
                                    className={cn(
                                        "text-sm text-white p-1 rounded-full w-6 text-center",
                                        notifications.length > 0
                                            ? "bg-red-500"
                                            : "bg-green-500"
                                    )}
                                >
                                    {notifications.length}
                                </p>
                            </div>
                        </>
                    </Button>
                </div>
            </div>

            <SidebarElement
                name="Home"
                icon={<House />}
                link="/"
                onClick={onElementClick}
            />
            {isAdmin() && (
                <>
                    <SidebarElement
                        name="Incidents"
                        icon={<TriangleAlert />}
                        link="/incidents"
                        onClick={onElementClick}
                    />
                    <SidebarElement
                        name="Users"
                        icon={<UserCog />}
                        link="/users"
                        onClick={onElementClick}
                    />
                    <SidebarElement
                        name="Devices"
                        icon={<Microchip />}
                        link="/devices"
                        onClick={onElementClick}
                    />
                    <SidebarElement
                        name="Competition"
                        icon={<Trophy />}
                        link="/competition"
                        onClick={onElementClick}
                    />
                    <SidebarElement
                        name="Scrambles"
                        icon={<Puzzle />}
                        link="/scrambles"
                        onClick={onElementClick}
                    />
                </>
            )}
            <SidebarElement
                name="Persons"
                icon={<Users />}
                link="/persons"
                onClick={onElementClick}
            />
            {isAdmin() && (
                <SidebarElement
                    name="Attendance"
                    icon={<ClipboardList />}
                    link="/attendance"
                    onClick={onElementClick}
                />
            )}
            <SidebarElement
                name="Check in"
                icon={<SquareCheckBig />}
                link="/check-in"
                onClick={onElementClick}
            />
            <SidebarElement
                name="Results"
                icon={<AlarmClock />}
                link={isAdmin() ? "/results" : "/results/public"}
                onClick={onElementClick}
            />
            {isAdmin() && (
                <SidebarElement
                    name="Checks"
                    icon={<BookCheck />}
                    link="/results/checks"
                    onClick={onElementClick}
                />
            )}
            <SidebarElement
                name="Settings"
                icon={<Settings />}
                link="/settings"
                onClick={onElementClick}
            />
            <a href={GITHUB_URL} target="_blank">
                <img src={github} alt="GitHub" width="32" color="white" />
            </a>
        </div>
    );
};

export default SidebarContent;
