import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import { Box } from "@chakra-ui/react";
import { getToken, getUserInfo } from "../logic/auth";
import { useEffect } from "react";

const Layout = (): JSX.Element => {
    const userInfo = getUserInfo();
    const navigate = useNavigate();

    useEffect(() => {
        const token = getToken();
        if (!token) {
            navigate("/auth/login");
        }
    }, [navigate]);

    if (!userInfo) {
        return <></>;
    }
    return (
        <Box display="flex">
            <Sidebar user={userInfo} />
            <Box width="100%" padding="5" color="white">
                <Outlet />
            </Box>
        </Box>
    );
};

export default Layout;
