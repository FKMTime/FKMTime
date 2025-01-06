import { useAtom } from "jotai";
import { AlertCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import { Alert, AlertDescription, AlertTitle } from "@/Components/ui/alert";
import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import { getCompetitionInfo } from "@/lib/competition";
import { isUnofficialEvent } from "@/lib/events";
import { Room } from "@/lib/interfaces";
import { getAllRooms, updateCurrentRound } from "@/lib/rooms";

import RoomCard from "./Components/RoomCard";

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
                        <Button
                            onClick={handleSubmit}
                            variant="success"
                            className="w-fit"
                        >
                            Save
                        </Button>
                    </CardTitle>
                </CardHeader>
            </Card>
            <div className="flex flex-col gap-5 w-full md:w-fit">
                {currentOfficialRounds.length > 0 && (
                    <Alert variant="warning">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>
                            Remember to open the following rounds in WCA Live:
                        </AlertTitle>
                        <AlertDescription>
                            <ul>
                                {currentOfficialRounds.map((room) => (
                                    <ol>
                                        {activityCodeToName(
                                            room.currentGroupId?.split("-g")[0]
                                        )}
                                    </ol>
                                ))}
                            </ul>
                        </AlertDescription>
                    </Alert>
                )}

                <div className="flex flex-wrap gap-5">
                    {rooms.map((room: Room) => (
                        <RoomCard
                            room={room}
                            key={room.id}
                            competition={competition}
                            updateCurrentGroup={updateCurrentGroup}
                            currentGroupId={room.currentGroupId}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Rooms;
