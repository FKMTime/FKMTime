import { Box, Button, Heading, Text } from "@chakra-ui/react";
import { MdBook, MdHome, MdLogout, MdPerson, MdPersonAdd, MdSettings, MdTimer } from "react-icons/md";
import SidebarElement from "../Components/SidebarElement";
import { IoMdTrophy } from "react-icons/io";
import React from "react";
import { UserInfo } from "../logic/interfaces";
import { useNavigate } from "react-router-dom";
import { useToast } from "@chakra-ui/react";
import { logout } from "../logic/auth";

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
        navigate('/auth/login');
    };

    return (
        <Box height="100vw" backgroundColor="gray.600" width="20vh" alignItems="center" padding="5" display="flex" flexDirection="column" gap="5">
            <Heading color="white">Panel</Heading>
            <Text color="white">Hello {user.username}!</Text>
            <Text color="white">Logged in as {user.role.toLowerCase()}</Text>
            <SidebarElement name='Home' icon={<MdHome />} link='/' />
            {user.role === "ADMIN" && (
                <>
                    <SidebarElement name='Accounts' icon={<MdPersonAdd />} link='/accounts' />
                    <SidebarElement name="Stations" icon={<MdSettings />} link='/stations' />
                    <SidebarElement name='Competition' icon={<IoMdTrophy />} link='/competition' />
                </>
            )}
            <SidebarElement name='Persons' icon={<MdPerson />} link='/persons' />
            <SidebarElement name='Results' icon={<MdTimer />} link='/results' />
            <SidebarElement name='Settings' icon={<MdSettings />} link='/settings' />
            <SidebarElement name='Tutorial' icon={<MdBook />} link='/tutorial' />
            <Button leftIcon={<MdLogout />} colorScheme='teal' variant='solid' rounded="20" width="100%" textAlign="center" onClick={handleLogout}>
                Logout
            </Button>
        </Box>
    )
};

export default Sidebar;
