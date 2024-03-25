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
import React, { useState } from "react";
import { UserInfo } from "../logic/interfaces";
import { useNavigate } from "react-router-dom";
import { logout } from "../logic/auth";
import SidebarContent from "./SidebarContent.tsx";
import { MdMenu } from "react-icons/md";

interface SidebarProps {
    user: UserInfo;
}

const Sidebar: React.FC<SidebarProps> = ({ user }): JSX.Element => {
    const navigate = useNavigate();
    const toast = useToast();
    const [isDrawerOpen, setDrawerOpen] = useState<boolean>(false);

    const handleLogout = () => {
        logout();
        toast({
            title: "Logged out",
            description: "You have been logged out.",
            status: "success",
            duration: 9000,
            isClosable: true,
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
                height="100vh"
                width={{ base: "100%", "2xl": "20vh" }}
                display={{ base: "none", "2xl": "flex" }}
            >
                <SidebarContent user={user} handleLogout={handleLogout} />
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
                            toggleDrawer={toggleDrawer}
                        />
                    </DrawerBody>
                </DrawerContent>
            </Drawer>
        </>
    );
};

export default Sidebar;
