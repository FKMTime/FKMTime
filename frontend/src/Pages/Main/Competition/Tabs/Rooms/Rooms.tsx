import { useAtom } from "jotai";
import { CalendarCog } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import { Button } from "@/Components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/Components/ui/card";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import { getCompetitionInfo } from "@/lib/competition";
import { isUnofficialEvent } from "@/lib/events";
import { Room } from "@/lib/interfaces";
import { getAllRooms, updateCurrentRound } from "@/lib/rooms";
import PageTransition from "@/Pages/PageTransition";

import RoomsTable from "./Components/RoomsTable";

const Rooms = () => {
    const { toast } = useToast();
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [rooms, setRooms] = useState<Room[]>([]);

    const fetchData = useCallback(async () => {
        const response = await getCompetitionInfo();
        setCompetition(response.data);
    }, [setCompetition]);

    useEffect(() => {
        if (!competition) {
            fetchData();
        }
    }, [competition, fetchData]);

    useEffect(() => {
        getAllRooms().then((data: Room[]) => {
            setRooms(data);
        });
    }, []);

    const currentOfficialRounds: string[] = [];

    rooms.filter((room) => {
        if (room.currentGroupIds.length > 0) {
            for (const currentGroup of room.currentGroupIds) {
                const roundId = currentGroup.split("-g")[0];
                if (
                    !isUnofficialEvent(roundId.split("-")[0]) &&
                    !currentOfficialRounds.some((r) => r === roundId)
                ) {
                    currentOfficialRounds.push(roundId);
                }
            }
        }
    });

    const updateCurrentGroups = (roomId: string, groups: string[]) => {
        const roundIds: string[] = [];
        const eventIds: string[] = [];
        for (const groupId of groups) {
            const eventId = groupId.split("-r")[0];
            if (eventIds.includes(eventId)) {
                toast({
                    title: "You cannot have 2 or more groups in the room for the same event",
                    variant: "destructive",
                });
                return;
            }
            eventIds.push(eventId);
            const roundId = groupId.split("-g")[0];
            if (roundIds.includes(roundId)) {
                toast({
                    title: "You cannot have 2 or more groups in the room for the same round",
                    variant: "destructive",
                });
                return;
            }
            roundIds.push(roundId);
        }
        setRooms(
            rooms.map((r) => {
                if (r.id === roomId) {
                    return {
                        ...r,
                        currentGroupIds: groups,
                    };
                }
                return r;
            })
        );
    };

    const handleSubmit = async () => {
        const response = await updateCurrentRound(rooms);
        if (response.status === 200) {
            toast({
                title: "Rooms updated",
                variant: "success",
            });
        } else if (response.status === 400) {
            toast({
                title: response.data.message,
                variant: "destructive",
            });
        } else {
            toast({
                title: "Something went wrong!",
                variant: "destructive",
            });
        }
    };

    if (!competition) {
        return <LoadingPage />;
    }

    return (
        <PageTransition>
            <div className="flex flex-col gap-3 w-full">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex gap-2 items-center">
                            <CalendarCog size={20} />
                            Manage current groups
                        </CardTitle>
                        <CardDescription>
                            {currentOfficialRounds.length > 0 && (
                                <>
                                    Remember to open the following rounds in WCA
                                    Live:
                                    <ul className="list-disc ml-5">
                                        {currentOfficialRounds.map((round) => (
                                            <li>{activityCodeToName(round)}</li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        <RoomsTable
                            competition={competition}
                            rooms={rooms}
                            updateCurrentGroups={updateCurrentGroups}
                        />
                        <Button
                            onClick={handleSubmit}
                            variant="success"
                            className="w-fit"
                        >
                            Save
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </PageTransition>
    );
};

export default Rooms;
