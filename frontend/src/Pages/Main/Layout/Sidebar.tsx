import {
    Box,
    Circle,
    Drawer,
    DrawerBody,
    DrawerCloseButton,
    DrawerContent,
    DrawerOverlay,
    useToast,
} from "@chakra-ui/react";
import { useState } from "react";
import { MdMenu } from "react-icons/md";
import { useNavigate } from "react-router-dom";

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
    const toast = useToast();
    const [isDrawerOpen, setDrawerOpen] = useState<boolean>(false);

    const handleLogout = () => {
        logout();
        toast({
            title: "Logged out",
            description: "You have been logged out.",
            status: "success",
        });
        navigate("/auth/login");
    };

    const toggleDrawer = () => {
        setDrawerOpen(!isDrawerOpen);
    };

    return (
        <>
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
            <Box
                height="fit-content"
                width={{ base: "100%", "2xl": "20vh" }}
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
            <Drawer
                isOpen={isDrawerOpen}
                placement="left"
                onClose={toggleDrawer}
            >
                <DrawerOverlay />
                <DrawerContent backgroundColor="gray.600" width="100vh">
                    <DrawerCloseButton color="white" />
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
            </Drawer>
        </>
    );
};

export default Sidebar;
