import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import { Box } from "@chakra-ui/react";
import { getUserInfo } from "../logic/auth";

const Layout = (): JSX.Element => {

    const userInfo = getUserInfo();
    const navigate = useNavigate();
    if (!userInfo) {
        navigate('/auth/login');
    }

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
