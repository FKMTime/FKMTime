import {
    Box,
    Button,
    Icon,
    IconButton,
    Image,
    Link,
    Text,
} from "@chakra-ui/react";
import {
    FaClipboardList,
    FaGithub,
    FaPuzzlePiece,
    FaServer,
} from "react-icons/fa";
import { GrDocumentVerified } from "react-icons/gr";
import { IoMdNotifications, IoMdTrophy, IoMdWarning } from "react-icons/io";
import {
    MdDone,
    MdHome,
    MdPerson,
    MdPersonAdd,
    MdSettings,
    MdTimer,
} from "react-icons/md";

import logo from "@/assets/logo.svg";
import { Avatar } from "@/Components/ui/avatar";
import {
    MenuContent,
    MenuItem,
    MenuRoot,
    MenuTrigger,
} from "@/Components/ui/menu";
import { isAdmin } from "@/logic/auth.ts";
import { GITHUB_URL } from "@/logic/constants";
import { Competition, INotification, UserInfo } from "@/logic/interfaces";

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
        <Box
            backgroundColor="gray.900"
            overflowY="auto"
            display="flex"
            flexDirection="column"
            gap="5"
            alignItems="center"
            padding={5}
            height="100vh"
        >
            <Image src={logo} alt="Logo" width="100%" />
            <Box
                display="flex"
                rounded="20"
                padding={2}
                gap={5}
                alignItems="center"
                justifyContent="center"
                width="100%"
                textAlign="center"
            >
                <MenuRoot>
                    <MenuTrigger>
                        <Avatar
                            src={user.avatarUrl}
                            name={user.fullName ? user.fullName : user.username}
                        />
                    </MenuTrigger>
                    <MenuContent>
                        <MenuItem onClick={handleLogout} value="logout">
                            Logout
                        </MenuItem>
                    </MenuContent>
                </MenuRoot>
                <Box position="relative" display={isAdmin() ? "block" : "none"}>
                    <IconButton
                        background="transparent"
                        cursor={
                            notifications.length > 0 ? "pointer" : "default"
                        }
                        onClick={onClickNotifications}
                    >
                        <>
                            <IoMdNotifications size={32} />
                            <Box position="absolute" top="-3" right="-3">
                                <Text
                                    fontSize="sm"
                                    color="white"
                                    backgroundColor={
                                        notifications.length > 0
                                            ? "red.500"
                                            : "green.500"
                                    }
                                    padding={1}
                                    rounded="full"
                                    width="30px"
                                >
                                    {notifications.length}
                                </Text>
                            </Box>
                        </>
                    </IconButton>
                </Box>
            </Box>

            <SidebarElement
                name="Home"
                icon={<MdHome />}
                link="/"
                onClick={onElementClick}
            />
            {isAdmin() && (
                <>
                    <SidebarElement
                        name="Incidents"
                        icon={<IoMdWarning />}
                        link="/incidents"
                        onClick={onElementClick}
                    />
                    <SidebarElement
                        name="Users"
                        icon={<MdPersonAdd />}
                        link="/users"
                        onClick={onElementClick}
                    />
                    <SidebarElement
                        name="Devices"
                        icon={<MdSettings />}
                        link="/devices"
                        onClick={onElementClick}
                    />
                    <SidebarElement
                        name="Competition"
                        icon={<IoMdTrophy />}
                        link="/competition"
                        onClick={onElementClick}
                    />
                    <SidebarElement
                        name="Scrambles"
                        icon={<FaPuzzlePiece />}
                        link="/scrambles"
                        onClick={onElementClick}
                    />
                </>
            )}
            <SidebarElement
                name="Persons"
                icon={<MdPerson />}
                link="/persons"
                onClick={onElementClick}
            />
            {isAdmin() && (
                <SidebarElement
                    name="Attendance"
                    icon={<FaClipboardList />}
                    link="/attendance"
                    onClick={onElementClick}
                />
            )}
            <SidebarElement
                name="Check in"
                icon={<MdDone />}
                link="/check-in"
                onClick={onElementClick}
            />
            <SidebarElement
                name="Results"
                icon={<MdTimer />}
                link={isAdmin() ? "/results" : "/results/public"}
                onClick={onElementClick}
            />
            {isAdmin() && (
                <SidebarElement
                    name="Checks"
                    icon={<GrDocumentVerified />}
                    link="/results/checks"
                    onClick={onElementClick}
                />
            )}
            <SidebarElement
                name="Settings"
                icon={<MdSettings />}
                link="/settings"
                onClick={onElementClick}
            />
            {import.meta.env.PROD && isAdmin() && (
                <a href="/logs" style={{ width: "100%" }} target="_blank">
                    <Button
                        colorPalette="teal"
                        variant="solid"
                        rounded="20"
                        width="100%"
                        textAlign="center"
                    >
                        <FaServer />
                        Logs
                    </Button>
                </a>
            )}
            <Link href={GITHUB_URL}>
                <IconButton
                    color="white"
                    background="transparent"
                    _hover={{ opacity: 0.8 }}
                >
                    <FaGithub />
                </IconButton>
            </Link>
        </Box>
    );
};

export default SidebarContent;
