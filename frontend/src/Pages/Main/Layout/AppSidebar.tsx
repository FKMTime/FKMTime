import { useAtomValue } from "jotai";
import {
    AlarmClock,
    BookCheck,
    ChartNoAxesColumn,
    ClipboardList,
    House,
    Medal,
    Microchip,
    Puzzle,
    Settings,
    SquareCheckBig,
    TriangleAlert,
    Trophy,
    UserCog,
    Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import github from "@/assets/github.svg";
import logo from "@/assets/logo.svg";
import EventIcon from "@/Components/Icons/EventIcon";
import Tooltip from "@/Components/Tooltip";
import { Badge } from "@/Components/ui/badge";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarRail,
} from "@/Components/ui/sidebar";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import { isAdmin } from "@/lib/auth";
import { GITHUB_URL } from "@/lib/constants";
import { Room } from "@/lib/interfaces";
import { getAllRooms } from "@/lib/rooms";

interface AppSidebarProps {
    unresolvedIncidentsCount: number;
}

const AppSidebar = ({ unresolvedIncidentsCount }: AppSidebarProps) => {
    const location = useLocation();
    const [currentRounds, setCurrentRounds] = useState<string[]>([]);
    const competition = useAtomValue(competitionAtom);

    useEffect(() => {
        getAllRooms().then((data) => {
            const ids = new Set<string>(
                data
                    .filter((room: Room) => room.currentGroupId)
                    .map((room: Room) => room.currentGroupId.split("-g")[0])
            );
            setCurrentRounds([...ids]);
        });
    }, []);

    return (
        <Sidebar collapsible="offcanvas" variant="sidebar">
            <SidebarHeader className="flex items-center justify-center">
                <img src={logo} alt="Logo" width="80%" />
                <p className="text-center font-bold">{competition?.name}</p>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>General</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={location.pathname === "/"}
                                >
                                    <Link to="/">
                                        <House />
                                        <span>Home</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            {isAdmin() ? (
                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={
                                            location.pathname === "/incidents"
                                        }
                                    >
                                        <Link to="/incidents">
                                            <TriangleAlert />
                                            <span>Incidents</span>
                                        </Link>
                                    </SidebarMenuButton>
                                    <SidebarMenuBadge>
                                        <Badge
                                            variant={
                                                unresolvedIncidentsCount === 0
                                                    ? "success"
                                                    : "destructive"
                                            }
                                        >
                                            {unresolvedIncidentsCount}
                                        </Badge>
                                    </SidebarMenuBadge>
                                </SidebarMenuItem>
                            ) : null}
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={location.pathname === "/persons"}
                                >
                                    <Link to="/persons">
                                        <Users />
                                        <span>Persons</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={location.pathname === "/check-in"}
                                >
                                    <Link to="/check-in">
                                        <SquareCheckBig />
                                        <span>Check in</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            {isAdmin() ? (
                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={location.pathname.includes(
                                            "/attendance"
                                        )}
                                    >
                                        <Link to="/attendance">
                                            <ClipboardList />
                                            <span>Attendance</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ) : null}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
                <SidebarGroup>
                    <SidebarGroupLabel>Results</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={
                                        location.pathname.includes(
                                            "/results"
                                        ) &&
                                        location.pathname !==
                                            "/results/checks" &&
                                        !currentRounds.some((roundId) =>
                                            location.pathname.includes(roundId)
                                        )
                                    }
                                >
                                    <Link
                                        to={
                                            isAdmin()
                                                ? "/results"
                                                : "/results/public"
                                        }
                                    >
                                        <AlarmClock />
                                        <span>Results</span>
                                    </Link>
                                </SidebarMenuButton>
                                {currentRounds.length > 0 ? (
                                    <SidebarMenuSub>
                                        {currentRounds.map(
                                            (roundId: string) => (
                                                <SidebarMenuSubItem>
                                                    <SidebarMenuSubButton
                                                        isActive={
                                                            location.pathname ===
                                                            `/results/round/${roundId}`
                                                        }
                                                    >
                                                        <Link
                                                            className="flex gap-2 items-center"
                                                            to={
                                                                isAdmin()
                                                                    ? `/results/round/${roundId}`
                                                                    : `/results/public/${roundId}`
                                                            }
                                                        >
                                                            <EventIcon
                                                                selected
                                                                eventId={
                                                                    roundId.split(
                                                                        "-"
                                                                    )[0]
                                                                }
                                                            />
                                                            <Tooltip
                                                                content={activityCodeToName(
                                                                    roundId
                                                                )}
                                                            >
                                                                {
                                                                    activityCodeToName(
                                                                        roundId
                                                                    ).split(
                                                                        ", Round"
                                                                    )[0]
                                                                }
                                                            </Tooltip>
                                                        </Link>
                                                    </SidebarMenuSubButton>
                                                </SidebarMenuSubItem>
                                            )
                                        )}
                                    </SidebarMenuSub>
                                ) : null}
                            </SidebarMenuItem>
                            {isAdmin() ? (
                                <>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={
                                                location.pathname ===
                                                "/results/checks"
                                            }
                                        >
                                            <Link to={"/results/checks"}>
                                                <BookCheck />
                                                <span>Results checks</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                </>
                            ) : null}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
                {isAdmin() ? (
                    <SidebarGroup>
                        <SidebarGroupLabel>
                            Manage competition
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={
                                            location.pathname === "/competition"
                                        }
                                    >
                                        <Link to="/competition">
                                            <Trophy />
                                            <span>Competition</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={
                                            location.pathname === "/events"
                                        }
                                    >
                                        <Link to="/events">
                                            <Medal />
                                            <span>Unofficial events</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={
                                            location.pathname === "/users"
                                        }
                                    >
                                        <Link to="/users">
                                            <UserCog />
                                            <span>Users</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={
                                            location.pathname === "/scrambles"
                                        }
                                    >
                                        <Link to="/scrambles">
                                            <Puzzle />
                                            <span>Scrambles</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={
                                            location.pathname === "/devices"
                                        }
                                    >
                                        <Link to="/devices">
                                            <Microchip />
                                            <span>Devices</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                ) : null}
                <SidebarGroup>
                    <SidebarGroupLabel>Other</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={
                                        location.pathname === "/statistics"
                                    }
                                >
                                    <Link to="/statistics">
                                        <ChartNoAxesColumn />
                                        <span>Statistics</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>

                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={location.pathname === "/settings"}
                                >
                                    <Link to="/settings">
                                        <Settings />
                                        <span>Settings</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter className="flex items-center justify-center pb-5">
                <a href={GITHUB_URL} target="_blank">
                    <img src={github} alt="GitHub" width="32" color="white" />
                </a>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
};

export default AppSidebar;
