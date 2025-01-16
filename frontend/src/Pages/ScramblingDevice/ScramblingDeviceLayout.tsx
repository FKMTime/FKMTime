import { useSetAtom } from "jotai";
import { Suspense, useCallback, useEffect } from "react";
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
        <div className="flex flex-col h-screen p-5">
            <Suspense fallback={<LoadingPage />}>
                <Outlet />
            </Suspense>
        </div>
    );
};

export default ScramblingDeviceLayout;
