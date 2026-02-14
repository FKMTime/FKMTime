/* eslint-disable react-hooks/set-state-in-effect, react-hooks/preserve-manual-memoization */
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import EventAndRoundSelector from "@/Components/EventAndRoundSelector";
import LoadingPage from "@/Components/LoadingPage";
import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import { logout } from "@/lib/auth";
import { Room, ScrambleSet } from "@/lib/interfaces";
import {
    getScrambleSetsForScramblingDevice,
    getScramblingDeviceRoom,
} from "@/lib/scrambling";
import PageTransition from "@/Pages/PageTransition";

import ScrambleSetsTable from "./Components/ScrambleSetsTable";

const ScramblingDeviceHome = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const competition = useAtomValue(competitionAtom);
    const [roundId, setRoundId] = useState<string>("");
    const [scrambleSets, setScrambleSets] = useState<ScrambleSet[]>([]);
    const [room, setRoom] = useState<Room | null>(null);

    const handleEventChange = async (eventId: string) => {
        const id = eventId + "-r1";
        setRoundId(id);
        fetchData(id);
    };

    const handleRoundChange = (newId: string) => {
        setRoundId(newId);
        fetchData(newId);
    };

    const fetchData = useCallback(
        async (id?: string) => {
            const data = await getScrambleSetsForScramblingDevice(
                id || roundId
            );
            setScrambleSets(data);
        },
        [roundId]
    );

    const handleLogout = () => {
        logout();
        toast({
            title: "Logged out",
            description: "You have been logged out.",
        });
        navigate("/auth/login");
    };

    useEffect(() => {
        getScramblingDeviceRoom().then((data: Room) => {
            setRoom(data);
            if (data.currentGroupIds.length > 0 && !roundId) {
                if (data.currentGroupIds.length === 1) {
                    setRoundId(data.currentGroupIds[0].split("-g")[0]);
                    fetchData(data.currentGroupIds[0].split("-g")[0]);
                }
            }
        });
    }, [fetchData, roundId]);

    if (!competition) return <LoadingPage />;

    return (
        <PageTransition>
            <div className="flex flex-col gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            Scrambling device
                            <Button onClick={handleLogout}>Logout</Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <EventAndRoundSelector
                            competition={competition}
                            filters={{
                                eventId: roundId.split("-")[0],
                                roundId: roundId,
                            }}
                            handleEventChange={handleEventChange}
                            handleRoundChange={handleRoundChange}
                        />
                    </CardContent>
                </Card>
                {roundId ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>{activityCodeToName(roundId)}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ScrambleSetsTable
                                scrambleSets={scrambleSets}
                                showScrambleButton={
                                    room?.currentGroupIds.some(
                                        (g) => g.split("-g")[0] === roundId
                                    ) || false
                                }
                            />
                        </CardContent>
                    </Card>
                ) : null}
            </div>
        </PageTransition>
    );
};

export default ScramblingDeviceHome;
