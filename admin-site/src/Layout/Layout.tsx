import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { Box } from "@chakra-ui/react";
import { getUserInfo } from "../logic/auth";

const Layout = (): JSX.Element => {

    const userInfo = getUserInfo();

    return (
        <Box display="flex">
            <Sidebar user={userInfo} />
            <Box width="100%" padding="5" color="white">
                <Outlet />
            </Box>
        </Box>
    )
};

export default Layout;
