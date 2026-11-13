import { useSetAtom } from "jotai";
import { Suspense, useCallback, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { competitionAtom } from "@/lib/atoms";
import { getCompetitionInfo } from "@/lib/competition";
import { getEvents } from "@/lib/events";
import { ScramblingDeviceRoom } from "@/lib/interfaces";
import { scramblingDeviceRoomQuery } from "@/lib/scrambling";
import { isScrambleDeviceTokenValid } from "@/lib/scramblingDevicesAuth";

import { ScramblingDeviceOutletContext } from "./scramblingDeviceContext";

const ScramblingDeviceLayout = () => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const setCompetition = useSetAtom(competitionAtom);
    // The room's current groups change during the day, so each page
    // loads them afresh
    const { data: roomData } = useLiveQuery(
        scramblingDeviceRoomQuery(pathname)
    );
    const room: ScramblingDeviceRoom | null = roomData ?? null;

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

    const context: ScramblingDeviceOutletContext = { room };

    return (
        <div className="flex min-h-dvh flex-col">
            <Suspense fallback={<LoadingPage />}>
                <Outlet context={context} />
            </Suspense>
        </div>
    );
};

export default ScramblingDeviceLayout;
