import { Box, FormControl, FormLabel, Heading, Text } from "@chakra-ui/react";
import { Event, Room as WCIFRoom, Venue } from "@wca/helpers";
import { useAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import EventIcon from "@/Components/Icons/EventIcon";
import LoadingPage from "@/Components/LoadingPage";
import Select from "@/Components/Select";
import { competitionAtom } from "@/logic/atoms";
import { isAdmin } from "@/logic/auth";
import {
    getActivitiesWithRealEndTime,
    getCompetitionInfo,
} from "@/logic/competition";
import { Activity, Room } from "@/logic/interfaces";
import { getAllRooms } from "@/logic/rooms";
import { getCompetitionDates } from "@/logic/utils";

import CompetitionStatistics from "./Components/CompetitionStatistics";
import HomeShortcuts from "./Components/HomeShortcuts";
import MobileSchedule from "./Components/Schedule/MobileSchedule";
import ScheduleTable from "./Components/Schedule/ScheduleTable";

const Home = () => {
    const navigate = useNavigate();
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [currentRounds, setCurrentRounds] = useState<string[]>([]);
    const [selectedVenue, setSelectedVenue] = useState<number>(0);
    const [selectedRoom, setSelectedRoom] = useState<number>(0);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [possibleDates, setPossibleDates] = useState<Date[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);

    const fetchActivitiesData = (
        selectedVenueId: number,
        selectedRoomId: number,
        date: Date
    ) => {
        getActivitiesWithRealEndTime(
            selectedVenueId,
            selectedRoomId,
            date
        ).then((data) => {
            setActivities(data);
        });
    };

    const fetchData = useCallback(async () => {
        const response = await getCompetitionInfo();
        if (response.status === 404) {
            navigate("/competition");
        }
        setCompetition(response.data);
        setSelectedVenue(response.data.wcif.schedule.venues[0].id);
        const competitionDates = getCompetitionDates(
            new Date(response.data.wcif.schedule.startDate),
            response.data.wcif.schedule.numberOfDays
        );
        setPossibleDates(competitionDates);
        const todayPresent = competitionDates.find(
            (date) => date.toDateString() === new Date().toDateString()
        );
        if (todayPresent) {
            setSelectedDate(new Date());
        } else {
            setSelectedDate(competitionDates[0]);
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
            fetchActivitiesData(selectedVenue, selectedRoom, selectedDate);
        });
    }, [selectedDate, selectedRoom, selectedVenue]);

    if (!competition || !rooms) {
        return <LoadingPage />;
    }

    return (
        <Box display="flex" flexDirection="column" gap="5">
            <Box
                display="flex"
                flexDirection={{
                    base: "column",
                    md: "row",
                }}
                gap={3}
                justifyContent="space-between"
            >
                <Box display="flex" flexDirection="column" gap="5">
                    <Heading size="lg">{competition?.name}</Heading>
                    <Box
                        display="flex"
                        flexDirection="row"
                        gap="5"
                        width={{ base: "100%", md: "50%" }}
                        flexWrap={{ base: "wrap", md: "nowrap" }}
                    >
                        {competition.wcif.events.map((event: Event) => (
                            <EventIcon
                                key={event.id}
                                eventId={event.id}
                                selected={true}
                                size={25}
                            />
                        ))}
                    </Box>
                    {isAdmin() && (
                        <HomeShortcuts
                            rooms={rooms}
                            currentRounds={currentRounds}
                        />
                    )}
                    <Box
                        display="flex"
                        flexDirection={{
                            base: "column",
                            md: "row",
                        }}
                        gap="5"
                    >
                        <FormControl width="fit-content">
                            <FormLabel>Date</FormLabel>
                            <Select
                                onChange={(e) => {
                                    setSelectedDate(new Date(e.target.value));
                                    fetchActivitiesData(
                                        selectedVenue,
                                        selectedRoom,
                                        new Date(e.target.value)
                                    );
                                }}
                                value={selectedDate.toISOString()}
                            >
                                {possibleDates.map((date) => (
                                    <option
                                        key={date.toISOString()}
                                        value={date.toISOString()}
                                    >
                                        {date.toISOString().split("T")[0]}
                                    </option>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl width="fit-content">
                            <FormLabel>Venue</FormLabel>
                            <Select
                                onChange={(e) => {
                                    setSelectedVenue(parseInt(e.target.value));
                                    fetchActivitiesData(
                                        parseInt(e.target.value),
                                        selectedRoom,
                                        selectedDate
                                    );
                                }}
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
                                onChange={(e) => {
                                    setSelectedRoom(parseInt(e.target.value));
                                    fetchActivitiesData(
                                        selectedVenue,
                                        parseInt(e.target.value),
                                        selectedDate
                                    );
                                }}
                                value={selectedRoom.toString()}
                            >
                                {competition?.wcif.schedule.venues
                                    .find(
                                        (venue: Venue) =>
                                            venue.id === selectedVenue
                                    )
                                    ?.rooms.map((room: WCIFRoom) => (
                                        <option key={room.id} value={room.id}>
                                            {room.name}
                                        </option>
                                    ))}
                            </Select>
                        </FormControl>
                    </Box>
                </Box>
                <CompetitionStatistics />
            </Box>
            {activities && activities.length > 0 ? (
                <>
                    <Box display={{ base: "none", md: "block" }}>
                        <ScheduleTable
                            activities={activities}
                            events={competition.wcif.events}
                        />
                    </Box>
                    <Box display={{ base: "block", md: "none" }}>
                        <MobileSchedule activities={activities} />
                    </Box>
                </>
            ) : (
                <Text>No activities</Text>
            )}
        </Box>
    );
};

export default Home;
