import { Box, Circle } from "@chakra-ui/react";
import { useSetAtom } from "jotai";
import { Suspense, useCallback, useEffect } from "react";
import { MdHome } from "react-icons/md";
import { Outlet, useNavigate } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import { competitionAtom } from "@/lib/atoms";
import { getCompetitionInfo } from "@/lib/competition";
import { getEvents } from "@/lib/events";
import { isScrambleDeviceTokenValid } from "@/lib/scramblingDevicesAuth";

const ScramblingDeviceLayout = () => {
    const navigate = useNavigate();
    const setCompetition = useSetAtom(competitionAtom);

    useEffect(() => {
        isScrambleDeviceTokenValid().then((isLoggedIn) => {
            if (!isLoggedIn) {
                navigate("/auth/login");
                window.location.reload();
            }
        });
    }, [navigate]);

    const fetchCompetition = useCallback(async () => {
        const response = await getCompetitionInfo();
        if (response.status === 404) {
            navigate("/competition/import");
        }
        setCompetition(response.data);
    }, [navigate, setCompetition]);

    const fetchEvents = async () => {
        await getEvents();
    };

    useEffect(() => {
        fetchCompetition();
    }, [fetchCompetition]);

    useEffect(() => {
        fetchEvents();
    }, []);

    return (
        <Box
            width="100%"
            padding="5"
            color="white"
            height="100vh"
            overflowY="auto"
        >
            <Circle
                position="fixed"
                top="1"
                right="1"
                backgroundColor="teal.500"
                fontSize="3rem"
                color="white"
                p={2}
                onClick={() => navigate("/scrambling-device")}
                size="4rem"
                zIndex={100}
                cursor="pointer"
            >
                <MdHome />
            </Circle>
            <Suspense fallback={<LoadingPage />}>
                <Outlet />
            </Suspense>
        </Box>
    );
};

export default ScramblingDeviceLayout;
