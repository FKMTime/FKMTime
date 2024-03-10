import {
    Box,
    Button,
    FormControl,
    FormLabel,
    Heading,
    Select,
    useToast,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { Room, Round } from "../../logic/interfaces.ts";
import { getAllRooms, updateCurrentRound } from "../../logic/rooms.ts";
import { useAtom } from "jotai";
import { competitionAtom } from "../../logic/atoms.ts";
import { getCompetitionInfo } from "../../logic/competition.ts";
import { getAllRounds } from "../../logic/utils.ts";

const Rooms = () => {
    const toast = useToast();
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [rounds, setRounds] = useState<Round[]>([]);

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
        if (!competition) return;
        const data = getAllRounds(competition.wcif);
        setRounds(data);
    }, [competition]);

    useEffect(() => {
        getAllRooms().then((rooms: Room[]) => {
            setRooms(rooms);
        });
    }, []);

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

    return (
        <Box display="flex" flexDirection="column" gap="5">
            <Heading size="lg">Rooms</Heading>
            {rooms.map((room: Room) => (
                <Box
                    key={room.id}
                    border="1px"
                    p="3"
                    borderColor="gray.200"
                    width="fit-content"
                >
                    <Heading size="md">{room.name}</Heading>
                    <FormControl>
                        <FormLabel>Current round</FormLabel>
                        <Select
                            placeholder="Select current round"
                            value={room.currentRoundId}
                            onChange={(e) => {
                                setRooms(
                                    rooms.map((r) => {
                                        if (r.id === room.id) {
                                            r.currentRoundId = e.target.value;
                                        }
                                        return r;
                                    })
                                );
                            }}
                        >
                            {rounds.map((round: Round) => (
                                <option key={round.id} value={round.id}>
                                    {round.name}
                                </option>
                            ))}
                        </Select>
                    </FormControl>
                </Box>
            ))}
            <Button onClick={handleSubmit} colorScheme="green" width="20%">
                Save
            </Button>
        </Box>
    );
};

export default Rooms;
