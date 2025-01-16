import { useAtom } from "jotai";
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

    const currentOfficialRounds: Room[] = [];

    rooms.filter((room) => {
        if (room.currentGroupId) {
            const roundId = room.currentGroupId?.split("-g")[0];
            if (
                !isUnofficialEvent(roundId.split("-")[0]) &&
                !currentOfficialRounds.some(
                    (r) => r.currentGroupId.split("-g")[0] === roundId
                )
            ) {
                currentOfficialRounds.push(room);
            }
        }
    });

    const updateCurrentGroup = (room: Room) => {
        setRooms(
            rooms.map((r) => {
                if (r.id === room.id) {
                    return room;
                }
                return r;
            })
        );
    };

    const handleSubmit = async () => {
        const status = await updateCurrentRound(rooms);
        if (status === 200) {
            toast({
                title: "Rooms updated",
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
        <div className="flex flex-col gap-3 w-full">
            <Card>
                <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                        Manage current groups
                    </CardTitle>
                    <CardDescription>
                        {currentOfficialRounds.length > 0 && (
                            <>
                                Remember to open the following rounds in WCA
                                Live:
                                <ul className="list-disc ml-5">
                                    {currentOfficialRounds.map((room) => (
                                        <li>
                                            {activityCodeToName(
                                                room.currentGroupId?.split(
                                                    "-g"
                                                )[0]
                                            )}
                                        </li>
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
                        updateCurrentGroup={updateCurrentGroup}
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
    );
};

export default Rooms;
