import { useAtom } from "jotai";
import { Suspense, useCallback, useContext, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import ModeToggle from "@/Components/ModeToggle";
import { StatusDot } from "@/Components/shared/StatusBadge";
import { competitionAtom } from "@/lib/atoms";
import { getPublicCompetitionInfo, getPublicRooms } from "@/lib/competition";
import { getEvents } from "@/lib/events";
import { Room } from "@/lib/interfaces";
import { cn } from "@/lib/utils";
import { socket, SocketContext } from "@/socket";

import { isPublicResultsPath, PublicOutletContext } from "./publicNavigation";
import PublicSidebar from "./PublicSidebar";
import PublicTabs from "./PublicTabs";

/**
 * Public display shell: a 240px sidebar from 760px up, below that the
 * wordmark in the header and two tabs under it.
 */
const PublicLayout = () => {
    const location = useLocation();
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [liveRoundIds, setLiveRoundIds] = useState<string[] | null>(null);
    const [isLive, setIsLive] = useState(socket.connected);
    const [isConnected, setConnected] = useContext(SocketContext) as [
        number,
        React.Dispatch<React.SetStateAction<number>>,
    ];
    const isResults = isPublicResultsPath(location.pathname);

    // Event names and icons are read from what getEvents stores, so they
    // must be in place before the competition renders anything
    const fetchCompetition = useCallback(async () => {
        const [response] = await Promise.all([
            getPublicCompetitionInfo(),
            getEvents(),
        ]);
        if (response.status === 200) {
            setCompetition(response.data);
        }
    }, [setCompetition]);

    useEffect(() => {
        fetchCompetition();
    }, [fetchCompetition]);

    // Refetched on reconnect: a dropped socket may have missed group changes
    useEffect(() => {
        getPublicRooms().then((rooms: Room[]) =>
            setLiveRoundIds([
                ...new Set(
                    (rooms ?? []).flatMap((room) =>
                        room.currentGroupIds.map((id) => id.split("-g")[0])
                    )
                ),
            ])
        );
    }, [isConnected]);

    useEffect(() => {
        const handleConnect = () => {
            setIsLive(true);
            setConnected((c) => c + 1);
        };
        const handleDisconnect = () => setIsLive(false);
        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);
        socket.connect();
        return () => {
            socket.off("connect", handleConnect);
            socket.off("disconnect", handleDisconnect);
            socket.disconnect();
        };
    }, [setConnected]);

    const outletContext: PublicOutletContext = { liveRoundIds };

    return (
        <div className="flex min-h-dvh">
            <PublicSidebar
                competitionName={competition?.name ?? ""}
                liveRoundIds={liveRoundIds ?? []}
            />
            <div className="flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-10 flex flex-col border-b bg-background">
                    <div className="flex min-h-[62px] items-center gap-3 px-4 py-3 min-[760px]:px-7">
                        <div className="flex min-w-0 flex-1 flex-col min-[760px]:hidden">
                            <span className="text-base font-bold">FKMTime</span>
                            <span className="truncate text-xs text-muted-foreground">
                                {competition?.name}
                            </span>
                        </div>
                        <h1 className="hidden flex-1 text-[15px] font-semibold min-[760px]:block">
                            {isResults ? "Results" : "Live solving"}
                        </h1>
                        <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-muted-foreground">
                            <StatusDot
                                tone={isLive ? "success" : "neutral"}
                                className="size-2"
                            />
                            {isLive ? "Live" : "Reconnecting"}
                        </span>
                        <ModeToggle className="size-[38px] shrink-0" />
                    </div>
                    <PublicTabs />
                </header>
                <main
                    className={cn(
                        "flex w-full flex-col px-4 pb-10 pt-4 min-[760px]:px-7 min-[760px]:pb-14 min-[760px]:pt-5",
                        isResults ? "max-w-[1100px]" : "max-w-[1440px]"
                    )}
                >
                    <Suspense fallback={<LoadingPage />}>
                        <Outlet context={outletContext} />
                    </Suspense>
                </main>
            </div>
        </div>
    );
};

export default PublicLayout;
