import { Alert, Box, Button, List } from "@chakra-ui/react";
import { useAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import { toaster } from "@/Components/ui/toaster";
import { activityCodeToName } from "@/logic/activities";
import { competitionAtom } from "@/logic/atoms";
import { getCompetitionInfo } from "@/logic/competition";
import { isUnofficialEvent } from "@/logic/events";
import { Room } from "@/logic/interfaces";
import { getAllRooms, updateCurrentRound } from "@/logic/rooms";

import RoomCard from "./Components/RoomCard";

const Rooms = () => {
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
            toaster.create({
                title: "Rooms updated",
                type: "success",
            });
        } else {
            toaster.create({
                title: "Something went wrong!",
                type: "error",
            });
        }
    };

    if (!competition) {
        return <LoadingPage />;
    }

    return (
        <Box
            display="flex"
            flexDirection="column"
            gap="5"
            width={{ base: "100%", md: "fit-content" }}
        >
            {currentOfficialRounds.length > 0 && (
                <Alert.Root
                    status="warning"
                    borderRadius="md"
                    color="black"
                    display="flex"
                    flexDirection="column"
                    alignItems="flex-start"
                >
                    Remember to open the following rounds in WCA Live:
                    <List.Root as="ul">
                        {currentOfficialRounds.map((room) => (
                            <List.Item>
                                {activityCodeToName(
                                    room.currentGroupId?.split("-g")[0]
                                )}
                            </List.Item>
                        ))}
                    </List.Root>
                </Alert.Root>
            )}

            <Box display="flex" flexWrap="wrap" gap="5">
                {rooms.map((room: Room) => (
                    <RoomCard
                        room={room}
                        key={room.id}
                        competition={competition}
                        updateCurrentGroup={updateCurrentGroup}
                        currentGroupId={room.currentGroupId}
                    />
                ))}
            </Box>
            <Button onClick={handleSubmit} colorPalette="green" width="100%">
                Save
            </Button>
        </Box>
    );
};

export default Rooms;
