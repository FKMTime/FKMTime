import { useCallback, useEffect, useMemo, useState } from "react";
import { getCompetitionInfo } from "../../logic/competition";
import LoadingPage from "../../Components/LoadingPage";
import {
    Box,
    FormControl,
    FormLabel,
    Heading,
    Input,
    Text,
} from "@chakra-ui/react";
import { Activity, Event, Room as WCIFRoom, Venue } from "@wca/helpers";
import ScheduleTable from "../../Components/Table/ScheduleTable";
import EventIcon from "../../Components/Icons/EventIcon";
import { useAtom } from "jotai";
import { competitionAtom } from "../../logic/atoms";
import { useNavigate } from "react-router-dom";
import MobileSchedule from "../../Components/Schedule/MobileSchedule.tsx";
import { Room } from "../../logic/interfaces.ts";
import { getAllRooms } from "../../logic/rooms.ts";
import { HAS_WRITE_ACCESS } from "../../logic/accounts.ts";
import HomeShortcuts from "../../Components/HomeShortcuts.tsx";
import { getUserInfo } from "../../logic/auth.ts";
import Select from "../../Components/Select.tsx";

const Home = (): JSX.Element => {
    const navigate = useNavigate();
    const userInfo = getUserInfo();
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [currentRounds, setCurrentRounds] = useState<string[]>([]);
    const [selectedVenue, setSelectedVenue] = useState<number>(0);
    const [selectedRoom, setSelectedRoom] = useState<number>(0);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const orderedActivities = useMemo(() => {
        if (!competition) {
            return [];
        }
        return competition.wcif.schedule.venues
            .find((venue: Venue) => venue.id === selectedVenue)
            ?.rooms.find((room: WCIFRoom) => room.id === selectedRoom)
            ?.activities.filter((a: Activity) => {
                if (new Date(a.startTime).getDay() === selectedDate.getDay()) {
                    return true;
                }
            })
            .sort((a: Activity, b: Activity) => {
                if (
                    new Date(a.startTime).getTime() <
                    new Date(b.startTime).getTime()
                ) {
                    return -1;
                }
                if (
                    new Date(a.startTime).getTime() >
                    new Date(b.startTime).getTime()
                ) {
                    return 1;
                }
                return 0;
            });
    }, [competition, selectedVenue, selectedRoom, selectedDate]);

    const fetchData = useCallback(async () => {
        const response = await getCompetitionInfo();
        if (response.status === 404) {
            navigate("/competition");
        }
        setCompetition(response.data);
        setSelectedVenue(response.data.wcif.schedule.venues[0].id);
        if (
            new Date(response.data.wcif.schedule.startDate).getTime() >
            new Date().getTime()
        ) {
            setSelectedDate(new Date(response.data.wcif.schedule.startDate));
        } else {
            setSelectedDate(new Date());
        }
        setSelectedRoom(response.data.wcif.schedule.venues[0].rooms[0].id);
    }, [navigate, setCompetition]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        getAllRooms().then((data) => {
            setRooms(data);
            const ids = new Set<string>(
                data
                    .filter((room: Room) => room.currentGroupId)
                    .map((room: Room) => room.currentGroupId.split("-g")[0])
            );
            setCurrentRounds([...ids]);
        });
    }, []);

    if (!competition || !rooms) {
        return <LoadingPage />;
    }

    return (
        <Box display="flex" flexDirection="column" gap="5">
            <Heading size="lg">{competition?.name}</Heading>
            <Box display="flex" flexDirection="row" gap="5" width="20%">
                {competition.wcif.events.map((event: Event) => (
                    <EventIcon
                        key={event.id}
                        eventId={event.id}
                        selected={true}
                        size={25}
                    />
                ))}
            </Box>
            {HAS_WRITE_ACCESS.includes(userInfo.role) && (
                <HomeShortcuts
                    rooms={rooms}
                    currentRounds={currentRounds}
                    competition={competition}
                />
            )}
            <Box display="flex" flexDirection="row" gap="5">
                <FormControl width="fit-content">
                    <FormLabel>Date</FormLabel>
                    <Input
                        type="date"
                        onChange={(e) =>
                            setSelectedDate(new Date(e.target.value))
                        }
                        value={selectedDate.toISOString().split("T")[0]}
                    />
                </FormControl>
                <FormControl width="fit-content">
                    <FormLabel>Venue</FormLabel>
                    <Select
                        onChange={(e) =>
                            setSelectedVenue(parseInt(e.target.value))
                        }
                        value={selectedVenue.toString()}
                    >
                        {competition?.wcif.schedule.venues.map(
                            (venue: Venue) => (
                                <option key={venue.id} value={venue.id}>
                                    {venue.name}
                                </option>
                            )
                        )}
                    </Select>
                </FormControl>
                <FormControl width="fit-content">
                    <FormLabel>Room</FormLabel>
                    <Select
                        onChange={(e) =>
                            setSelectedRoom(parseInt(e.target.value))
                        }
                        value={selectedRoom.toString()}
                    >
                        {competition?.wcif.schedule.venues
                            .find((venue: Venue) => venue.id === selectedVenue)
                            ?.rooms.map((room: WCIFRoom) => (
                                <option key={room.id} value={room.id}>
                                    {room.name}
                                </option>
                            ))}
                    </Select>
                </FormControl>
            </Box>
            {orderedActivities && orderedActivities.length > 0 ? (
                <>
                    <Box display={{ base: "none", md: "block" }}>
                        <ScheduleTable
                            activities={orderedActivities}
                            events={competition.wcif.events}
                        />
                    </Box>
                    <Box display={{ base: "block", md: "none" }}>
                        <MobileSchedule activities={orderedActivities} />
                    </Box>
                </>
            ) : (
                <Text>No activities</Text>
            )}
        </Box>
    );
};

export default Home;
