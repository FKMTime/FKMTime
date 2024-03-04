import {
    Box,
    Button,
    Icon,
    Image,
    Link,
    Text,
    useToast,
} from "@chakra-ui/react";
import {
    MdBook,
    MdHome,
    MdLogout,
    MdPerson,
    MdPersonAdd,
    MdSettings,
    MdTimer,
} from "react-icons/md";
import SidebarElement from "../Components/SidebarElement";
import { IoMdTrophy } from "react-icons/io";
import React from "react";
import { UserInfo } from "../logic/interfaces";
import { useNavigate } from "react-router-dom";
import { logout } from "../logic/auth";
import logo from "../assets/logo.svg";
import { FaGift, FaGithub } from "react-icons/fa";

interface SidebarProps {
    user: UserInfo;
}

const Sidebar: React.FC<SidebarProps> = ({ user }): JSX.Element => {
    const navigate = useNavigate();
    const toast = useToast();

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

    return (
        <Box
            height="100vw"
            backgroundColor="gray.600"
            width="20vh"
            alignItems="center"
            padding="5"
            display="flex"
            flexDirection="column"
            gap="5"
        >
            <Image src={logo} alt="Logo" width="100%" />
            <Text color="white">Hello {user.username}!</Text>
            <SidebarElement name="Home" icon={<MdHome />} link="/" />
            {user.role === "ADMIN" && (
                <>
                    <SidebarElement
                        name="Accounts"
                        icon={<MdPersonAdd />}
                        link="/accounts"
                    />
                    <SidebarElement
                        name="Stations"
                        icon={<MdSettings />}
                        link="/stations"
                    />
                    <SidebarElement
                        name="Competition"
                        icon={<IoMdTrophy />}
                        link="/competition"
                    />
                </>
            )}
            <SidebarElement
                name="Persons"
                icon={<MdPerson />}
                link="/persons"
            />
            <SidebarElement
                name="Giftpacks"
                icon={<FaGift />}
                link="/giftpacks"
            />
            <SidebarElement name="Results" icon={<MdTimer />} link="/results" />
            <SidebarElement
                name="Settings"
                icon={<MdSettings />}
                link="/settings"
            />
            <SidebarElement
                name="Tutorial"
                icon={<MdBook />}
                link="/tutorial"
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

export default Sidebar;
