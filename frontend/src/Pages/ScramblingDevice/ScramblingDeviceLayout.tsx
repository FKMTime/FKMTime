import { Box } from "@chakra-ui/react";
import { Suspense, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import { isScrambleDeviceTokenValid } from "@/logic/scramblingDevicesAuth";

const ScramblingDeviceLayout = () => {
    const navigate = useNavigate();

    useEffect(() => {
        isScrambleDeviceTokenValid().then((isLoggedIn) => {
            if (!isLoggedIn) {
                navigate("/auth/login");
                window.location.reload();
            }
        });
    }, [navigate]);

    return (
        <Box
            width="100%"
            padding="5"
            color="white"
            height="100vh"
            overflowY="auto"
        >
            <Suspense fallback={<LoadingPage />}>
                <Outlet />
            </Suspense>
        </Box>
    );
};

export default ScramblingDeviceLayout;
