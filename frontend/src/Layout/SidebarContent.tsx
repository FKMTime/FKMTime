import { Box, Button, Icon, Image, Link, Text } from "@chakra-ui/react";
import logo from "../assets/logo.svg";
import SidebarElement from "../Components/SidebarElement.tsx";
import {
    MdBook,
    MdHome,
    MdLogout,
    MdPerson,
    MdPersonAdd,
    MdRoom,
    MdSettings,
    MdTimer,
} from "react-icons/md";
import { IoMdTrophy, IoMdWarning } from "react-icons/io";
import { HAS_WRITE_ACCESS } from "../logic/accounts.ts";
import { FaClipboardList, FaGift, FaGithub } from "react-icons/fa";
import { UserInfo } from "../logic/interfaces.ts";

interface Props {
    user: UserInfo;
    handleLogout: () => void;
    toggleDrawer?: () => void;
}

const SidebarContent: React.FC<Props> = ({
    user,
    handleLogout,
    toggleDrawer,
}) => {
    return (
        <Box
            backgroundColor="gray.600"
            display="flex"
            flexDirection="column"
            gap="5"
            alignItems="center"
            padding={5}
        >
            <Image src={logo} alt="Logo" width="100%" />
            <Text color="white">Hello {user.username}!</Text>
            <SidebarElement
                name="Home"
                icon={<MdHome />}
                link="/"
                onClick={toggleDrawer}
            />
            {HAS_WRITE_ACCESS.includes(user.role) && (
                <SidebarElement
                    name="Incidents"
                    icon={<IoMdWarning />}
                    link="/incidents"
                    onClick={toggleDrawer}
                />
            )}
            {user.role === "ADMIN" && (
                <>
                    <SidebarElement
                        name="Accounts"
                        icon={<MdPersonAdd />}
                        link="/accounts"
                        onClick={toggleDrawer}
                    />
                    <SidebarElement
                        name="Devices"
                        icon={<MdSettings />}
                        link="/devices"
                        onClick={toggleDrawer}
                    />
                    <SidebarElement
                        name="Competition"
                        icon={<IoMdTrophy />}
                        link="/competition"
                        onClick={toggleDrawer}
                    />
                </>
            )}
            {HAS_WRITE_ACCESS.includes(user.role) && (
                <>
                    <SidebarElement
                        name="Rooms"
                        icon={<MdRoom />}
                        link="/rooms"
                        onClick={toggleDrawer}
                    />
                </>
            )}
            <SidebarElement
                name="Persons"
                icon={<MdPerson />}
                link="/persons"
                onClick={toggleDrawer}
            />
            {HAS_WRITE_ACCESS.includes(user.role) && (
                <SidebarElement
                    name="Attendance"
                    icon={<FaClipboardList />}
                    link="/attendance"
                    onClick={toggleDrawer}
                />
            )}
            <SidebarElement
                name="Giftpacks"
                icon={<FaGift />}
                link="/giftpacks"
                onClick={toggleDrawer}
            />
            <SidebarElement
                name="Results"
                icon={<MdTimer />}
                link="/results"
                onClick={toggleDrawer}
            />
            <SidebarElement
                name="Settings"
                icon={<MdSettings />}
                link="/settings"
                onClick={toggleDrawer}
            />
            <SidebarElement
                name="Tutorial"
                icon={<MdBook />}
                link="/tutorial"
                onClick={toggleDrawer}
            />
            <Button
                leftIcon={<MdLogout />}
                colorScheme="teal"
                variant="solid"
                rounded="20"
                width="100%"
                textAlign="center"
                onClick={handleLogout}
            >
                Logout
            </Button>
            <Link href="https://github.com/maxidragon/FKMTime" isExternal>
                <Icon
                    as={FaGithub}
                    color="white"
                    boxSize="10"
                    _hover={{ opacity: 0.8 }}
                />
            </Link>
        </Box>
    );
};

export default SidebarContent;
