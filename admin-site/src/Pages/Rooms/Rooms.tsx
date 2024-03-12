import { Box, Button, Heading, useToast } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { Room } from "../../logic/interfaces.ts";
import { getAllRooms, updateCurrentRound } from "../../logic/rooms.ts";
import { useAtom } from "jotai";
import { competitionAtom } from "../../logic/atoms.ts";
import { getCompetitionInfo } from "../../logic/competition.ts";
import RoomCard from "../../Components/RoomCard.tsx";
import LoadingPage from "../../Components/LoadingPage.tsx";

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
        getAllRooms().then((rooms: Room[]) => {
            setRooms(rooms);
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
        <Box display="flex" flexDirection="column" gap="5">
            <Heading size="lg">Rooms</Heading>
            {rooms.map((room: Room) => (
                <RoomCard
                    room={room}
                    key={room.id}
                    competition={competition}
                    updateCurrentGroup={updateCurrentGroup}
                    currentGroupId={room.currentGroupId}
                />
            ))}
            <Button onClick={handleSubmit} colorScheme="green" width="20%">
                Save
            </Button>
        </Box>
    );
};

export default Rooms;
