import { useSetAtom } from "jotai";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import { competitionAtom } from "@/lib/atoms";
import { getCompetitionInfo } from "@/lib/competition";
import { getEvents } from "@/lib/events";
import { Room } from "@/lib/interfaces";
import { getScramblingDeviceRoom } from "@/lib/scrambling";
import { isScrambleDeviceTokenValid } from "@/lib/scramblingDevicesAuth";

import { ScramblingDeviceOutletContext } from "./scramblingDeviceContext";

const ScramblingDeviceLayout = () => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const setCompetition = useSetAtom(competitionAtom);
    const [room, setRoom] = useState<Room | null>(null);

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

    useEffect(() => {
        fetchCompetition();
    }, [fetchCompetition]);

    useEffect(() => {
        getEvents();
    }, []);

    // The room's current groups change during the day, so refetch per page
    useEffect(() => {
        getScramblingDeviceRoom().then(setRoom);
    }, [pathname]);

    const context: ScramblingDeviceOutletContext = { room };

    return (
        <div className="flex min-h-screen flex-col">
            <Suspense fallback={<LoadingPage />}>
                <Outlet context={context} />
            </Suspense>
        </div>
    );
};

export default ScramblingDeviceLayout;
