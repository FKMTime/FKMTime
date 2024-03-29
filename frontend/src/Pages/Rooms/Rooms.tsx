import { Box, Button, Heading, useToast } from "@chakra-ui/react";
import { useAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import { competitionAtom } from "@/logic/atoms";
import { getCompetitionInfo } from "@/logic/competition";
import { Room } from "@/logic/interfaces";
import { getAllRooms, updateCurrentRound } from "@/logic/rooms";

import RoomCard from "./Components/RoomCard";

const Rooms = () => {
    const toast = useToast();
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
                status: "success",
                duration: 3000,
                isClosable: true,
            });
        } else {
            toast({
                title: "Something went wrong!",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        }
    };

    if (!competition) {
        return <LoadingPage />;
    }

    return (
        <Box display="flex" flexDirection="column" gap="5" width="fit-content">
            <Heading size="lg">Rooms</Heading>
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
            <Button onClick={handleSubmit} colorScheme="green" width="100%">
                Save
            </Button>
        </Box>
    );
};

export default Rooms;
