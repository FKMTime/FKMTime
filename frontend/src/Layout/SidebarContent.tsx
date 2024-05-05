import { Box, Button, Icon, Image, Link, Text } from "@chakra-ui/react";
import { FaClipboardList, FaGithub, FaServer } from "react-icons/fa";
import { IoMdTrophy, IoMdWarning } from "react-icons/io";
import {
    MdDone,
    MdHome,
    MdLogout,
    MdPerson,
    MdPersonAdd,
    MdRoom,
    MdSettings,
    MdTimer,
} from "react-icons/md";

import logo from "@/assets/logo.svg";
import { isAdmin } from "@/logic/auth.ts";
import { Competition, UserInfo } from "@/logic/interfaces";

import SidebarElement from "./SidebarElement";

interface SidebarContentProps {
    user: UserInfo;
    competition: Competition;
    handleLogout: () => void;
    onElementClick?: () => void;
}

const SidebarContent = ({
    user,
    competition,
    handleLogout,
    onElementClick,
}: SidebarContentProps) => {
    return (
        <Box
            backgroundColor="gray.600"
            display="flex"
            flexDirection="column"
            gap="5"
            alignItems="center"
            padding={5}
            width="100%"
        >
            <Image src={logo} alt="Logo" width="100%" />
            <Text
                textAlign="center"
                fontWeight="bold"
                fontSize="xl"
                color="white"
            >
                {competition.name}
            </Text>
            <Text color="white" textAlign="center">
                Hello {user.fullName ? user.fullName : user.username}!
            </Text>
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
                        name="Accounts"
                        icon={<MdPersonAdd />}
                        link="/accounts"
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
                        name="Rooms"
                        icon={<MdRoom />}
                        link="/rooms"
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
                link="/results"
                onClick={onElementClick}
            />
            <SidebarElement
                name="Settings"
                icon={<MdSettings />}
                link="/settings"
                onClick={onElementClick}
            />
            {import.meta.env.PROD && isAdmin() && (
                <a href="/logs" style={{ width: "100%" }} target="_blank">
                    <Button
                        leftIcon={<FaServer />}
                        colorScheme="teal"
                        variant="solid"
                        rounded="20"
                        width="100%"
                        textAlign="center"
                    >
                        Logs
                    </Button>
                </a>
            )}
            <Box width="100%">
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
            </Box>
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
