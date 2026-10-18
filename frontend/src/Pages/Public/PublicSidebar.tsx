import { useAtomValue } from "jotai";
import { AlarmClock, Radio } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import logo from "@/assets/logo.svg";
import EventIcon from "@/Components/Icons/EventIcon";
import Tooltip from "@/Components/Tooltip";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarRail,
} from "@/Components/ui/sidebar";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";

interface PublicSidebarProps {
    currentRounds: string[];
}

const PublicSidebar = ({ currentRounds }: PublicSidebarProps) => {
    const location = useLocation();
    const competition = useAtomValue(competitionAtom);

    return (
        <Sidebar collapsible="offcanvas" variant="sidebar">
            <SidebarHeader className="flex items-center justify-center">
                <img src={logo} alt="Logo" width="80%" />
                <p className="text-center font-bold">{competition?.name}</p>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Public display</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={location.pathname.startsWith(
                                        "/public/results"
                                    )}
                                >
                                    <Link to="/public/results">
                                        <AlarmClock />
                                        <span>Results</span>
                                    </Link>
                                </SidebarMenuButton>
                                {currentRounds.length > 0 && (
                                    <SidebarMenuSub>
                                        {currentRounds.map((roundId) => (
                                            <SidebarMenuSubItem key={roundId}>
                                                <SidebarMenuSubButton
                                                    isActive={
                                                        location.pathname ===
                                                        `/public/results/${roundId}`
                                                    }
                                                    asChild
                                                >
                                                    <Link
                                                        className="flex gap-2 items-center"
                                                        to={`/public/results/${roundId}`}
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
                                                            {activityCodeToName(
                                                                roundId,
                                                                true,
                                                                true
                                                            )}
                                                        </Tooltip>
                                                    </Link>
                                                </SidebarMenuSubButton>
                                            </SidebarMenuSubItem>
                                        ))}
                                    </SidebarMenuSub>
                                )}
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={
                                        location.pathname === "/public/live"
                                    }
                                >
                                    <Link to="/public/live">
                                        <Radio />
                                        <span>Live solving</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter />
            <SidebarRail />
        </Sidebar>
    );
};

export default PublicSidebar;
