import { useAtom } from "jotai";
import { Suspense, useCallback, useContext, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import ModeToggle from "@/Components/ModeToggle";
import { SidebarProvider, SidebarTrigger } from "@/Components/ui/sidebar";
import { competitionAtom } from "@/lib/atoms";
import { getPublicCompetitionInfo, getPublicRooms } from "@/lib/competition";
import { Room } from "@/lib/interfaces";
import { socket, SocketContext } from "@/socket";

import PublicSidebar from "./PublicSidebar";

const PublicLayout = () => {
    const [, setCompetition] = useAtom(competitionAtom);
    const [currentRounds, setCurrentRounds] = useState<string[]>([]);
    const [, setConnected] = useContext(SocketContext) as [
        number,
        React.Dispatch<React.SetStateAction<number>>,
    ];

    const fetchCompetition = useCallback(async () => {
        const response = await getPublicCompetitionInfo();
        if (response.status === 200) {
            setCompetition(response.data);
        }
    }, [setCompetition]);

    const fetchRooms = useCallback(async () => {
        const rooms: Room[] = await getPublicRooms();
        const ids = new Set<string>(
            rooms
                .flatMap((room) => room.currentGroupIds)
                .map((id) => id.split("-g")[0])
        );
        setCurrentRounds([...ids]);
    }, []);

    useEffect(() => {
        fetchCompetition();
        fetchRooms();
    }, [fetchCompetition, fetchRooms]);

    useEffect(() => {
        socket.connect();
        socket.on("connect", () => setConnected((c) => c + 1));
        return () => {
            socket.off("connect");
            socket.disconnect();
        };
    }, [setConnected]);

    return (
        <SidebarProvider>
            <PublicSidebar currentRounds={currentRounds} />
            <main className="w-full p-5 h-screen overflow-y-auto flex flex-col gap-5">
                <div className="flex justify-between">
                    <SidebarTrigger />
                    <ModeToggle />
                </div>
                <Suspense fallback={<LoadingPage />}>
                    <Outlet />
                </Suspense>
            </main>
        </SidebarProvider>
    );
};

export default PublicLayout;
