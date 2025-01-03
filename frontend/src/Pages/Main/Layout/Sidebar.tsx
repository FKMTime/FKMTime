import {
    Box,
    Circle,
    DrawerBody,
    DrawerContent,
    DrawerTrigger,
} from "@chakra-ui/react";
import { useState } from "react";
import { MdMenu } from "react-icons/md";
import { useNavigate } from "react-router-dom";

import { DrawerCloseTrigger, DrawerRoot } from "@/Components/ui/drawer";
import { toaster } from "@/Components/ui/toaster";
import { logout } from "@/logic/auth";
import { Competition, INotification, UserInfo } from "@/logic/interfaces";

import SidebarContent from "./SidebarContent";

interface SidebarProps {
    user: UserInfo;
    competition: Competition;
    notifications: INotification[];
    onClickNotifications: () => void;
}

const Sidebar = ({
    user,
    competition,
    notifications,
    onClickNotifications,
}: SidebarProps) => {
    const navigate = useNavigate();
    const [isDrawerOpen, setDrawerOpen] = useState<boolean>(false);

    const handleLogout = () => {
        logout();
        toaster.create({
            title: "Logged out",
            description: "You have been logged out.",
            type: "success",
        });
        navigate("/auth/login");
    };

    const toggleDrawer = () => {
        setDrawerOpen(!isDrawerOpen);
    };

    return (
        <>
            <Box
                height="fit-content"
                width={{ base: "100%", "2xl": "25vh" }}
                display={{ base: "none", "2xl": "flex" }}
            >
                <SidebarContent
                    user={user}
                    handleLogout={handleLogout}
                    competition={competition}
                    onClickNotifications={onClickNotifications}
                    notifications={notifications}
                />
            </Box>
            <DrawerRoot open={isDrawerOpen} placement="start">
                <DrawerTrigger>
                    <Circle
                        position="fixed"
                        display={{ base: "block", "2xl": "none" }}
                        top="1"
                        right="1"
                        backgroundColor="teal.500"
                        fontSize="3rem"
                        color="white"
                        p={2}
                        size="4rem"
                        zIndex={100}
                        onClick={toggleDrawer}
                        cursor="pointer"
                    >
                        <MdMenu />
                    </Circle>
                </DrawerTrigger>
                <DrawerContent backgroundColor="gray.900" width="100vh">
                    <DrawerCloseTrigger color="white" />
                    <DrawerBody>
                        <SidebarContent
                            user={user}
                            handleLogout={handleLogout}
                            onElementClick={toggleDrawer}
                            notifications={notifications}
                            competition={competition}
                            onClickNotifications={onClickNotifications}
                        />
                    </DrawerBody>
                </DrawerContent>
            </DrawerRoot>
        </>
    );
};

export default Sidebar;
