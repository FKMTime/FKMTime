import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Drawer, DrawerContent } from "@/Components/ui/drawer";
import { useToast } from "@/hooks/useToast";
import { logout } from "@/lib/auth";
import { Competition, INotification, UserInfo } from "@/lib/interfaces";

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
    const { toast } = useToast();
    const navigate = useNavigate();
    const [isDrawerOpen, setDrawerOpen] = useState<boolean>(false);

    const handleLogout = () => {
        logout();
        toast({
            title: "Logged out",
            description: "You have been logged out.",
        });
        navigate("/auth/login");
    };

    const toggleDrawer = () => {
        setDrawerOpen(!isDrawerOpen);
    };

    return (
        <>
            {/* <Circle
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
            </Circle> */}
            <div className="h-fit w-full 2xl:w-[25vh] hidden 2xl:flex">
                <SidebarContent
                    user={user}
                    handleLogout={handleLogout}
                    competition={competition}
                    onClickNotifications={onClickNotifications}
                    notifications={notifications}
                />
            </div>
            <Drawer open={isDrawerOpen} onClose={toggleDrawer}>
                <DrawerContent className="w-screen">
                    <SidebarContent
                        user={user}
                        handleLogout={handleLogout}
                        onElementClick={toggleDrawer}
                        notifications={notifications}
                        competition={competition}
                        onClickNotifications={onClickNotifications}
                    />
                </DrawerContent>
            </Drawer>
        </>
    );
};

export default Sidebar;
