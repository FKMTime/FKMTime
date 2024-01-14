import { Box, Heading, Text } from "@chakra-ui/react";
import { MdHome, MdPerson, MdPersonAdd, MdSettings, MdTimer } from "react-icons/md";
import SidebarElement from "../Components/SidebarElement";
import { IoMdTrophy } from "react-icons/io";
import React from "react";
import { UserInfo } from "../logic/interfaces";

interface SidebarProps {
    user: UserInfo;
}

const Sidebar: React.FC<SidebarProps> = ({ user }): JSX.Element => {
    return (
        <Box height="100vh" backgroundColor="gray.600" width="20vh" alignItems="center" padding="5" display="flex" flexDirection="column" gap="5">
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
        </Box>
    )
};

export default Sidebar;
