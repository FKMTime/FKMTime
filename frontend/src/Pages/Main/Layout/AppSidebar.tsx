import {
    AlarmClock,
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
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import github from "@/assets/github.svg";
import logo from "@/assets/logo.svg";
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
    SidebarRail,
} from "@/Components/ui/sidebar";
import { isAdmin } from "@/lib/auth";
import { GITHUB_URL } from "@/lib/constants";
import { getUnresolvedIncidentsCount } from "@/lib/incidents";

const AppSidebar = () => {
    const location = useLocation();
    const [unresolvedIncidentsCount, setUnresolvedIncidentsCount] =
        useState<number>(0);

    const items = [
        {
            title: "Home",
            url: "/",
            icon: House,
            show: true,
        },
        {
            title: "Incidents",
            url: "/incidents",
            icon: TriangleAlert,
            showBadge: true,
            badge: unresolvedIncidentsCount,
            show: isAdmin(),
        },
        {
            title: "Users",
            url: "/users",
            icon: UserCog,
            show: isAdmin(),
        },
        {
            title: "Devices",
            url: "/devices",
            icon: Microchip,
            show: isAdmin(),
        },
        {
            title: "Competition",
            url: "/competition",
            icon: Trophy,
            show: isAdmin(),
        },
        {
            title: "Scrambles",
            url: "/scrambles",
            icon: Puzzle,
            show: isAdmin(),
        },
        {
            title: "Persons",
            url: "/persons",
            icon: Users,
            show: true,
        },
        {
            title: "Attendance",
            url: "/attendance",
            icon: ClipboardList,
            show: isAdmin(),
        },
        {
            title: "Check in",
            url: "/check-in",
            icon: SquareCheckBig,
            show: true,
        },
        {
            title: "Results",
            url: isAdmin() ? "/results" : "/results/public",
            icon: AlarmClock,
            show: true,
        },
        {
            title: "Checks",
            url: "/results/checks",
            icon: BookCheck,
            show: isAdmin(),
        },
        {
            title: "Settings",
            url: "/settings",
            icon: Settings,
            show: true,
        },
    ];

    useEffect(() => {
        getUnresolvedIncidentsCount().then((data) =>
            setUnresolvedIncidentsCount(data.count)
        );
    }, []);

    return (
        <Sidebar collapsible="offcanvas" variant="sidebar">
            <SidebarHeader className="flex items-center justify-center">
                <img src={logo} alt="Logo" width="80%" />
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>General</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {items
                                .filter((item) => item.show)
                                .map((item) => (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={
                                                location.pathname === item.url
                                            }
                                        >
                                            <Link to={item.url}>
                                                <item.icon />
                                                <span>{item.title}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                        {item.showBadge && (
                                            <SidebarMenuBadge>
                                                <Badge
                                                    variant={
                                                        item.badge === 0
                                                            ? "success"
                                                            : "destructive"
                                                    }
                                                >
                                                    {item.badge}
                                                </Badge>
                                            </SidebarMenuBadge>
                                        )}
                                    </SidebarMenuItem>
                                ))}
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
