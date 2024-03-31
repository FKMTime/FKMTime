import { Box, Button, Icon, Image, Link, Text } from "@chakra-ui/react";
import { FaClipboardList, FaGift, FaGithub } from "react-icons/fa";
import { IoMdTrophy, IoMdWarning } from "react-icons/io";
import {
    MdHome,
    MdLogout,
    MdPerson,
    MdPersonAdd,
    MdRoom,
    MdSettings,
    MdTimer,
} from "react-icons/md";

import logo from "@/assets/logo.svg";
import { HAS_WRITE_ACCESS } from "@/logic/accounts";
import { UserInfo } from "@/logic/interfaces";

import SidebarElement from "./SidebarElement";

interface SidebarContentProps {
    user: UserInfo;
    handleLogout: () => void;
    onElementClick?: () => void;
}

const SidebarContent = ({
    user,
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
        >
            <Image src={logo} alt="Logo" width="100%" />
            <Text color="white" textAlign="center">
                Hello {user.fullName ? user.fullName : user.username}!
            </Text>
            <SidebarElement
                name="Home"
                icon={<MdHome />}
                link="/"
                onClick={onElementClick}
            />
            {HAS_WRITE_ACCESS.includes(user.role) && (
                <SidebarElement
                    name="Incidents"
                    icon={<IoMdWarning />}
                    link="/incidents"
                    onClick={onElementClick}
                />
            )}
            {user.role === "ADMIN" && (
                <>
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
                </>
            )}
            {HAS_WRITE_ACCESS.includes(user.role) && (
                <>
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
            {HAS_WRITE_ACCESS.includes(user.role) && (
                <SidebarElement
                    name="Attendance"
                    icon={<FaClipboardList />}
                    link="/attendance"
                    onClick={onElementClick}
                />
            )}
            <SidebarElement
                name="Giftpacks"
                icon={<FaGift />}
                link="/giftpacks"
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
