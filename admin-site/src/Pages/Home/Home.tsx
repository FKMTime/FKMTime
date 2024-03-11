import { useCallback, useEffect, useMemo, useState } from "react";
import { getCompetitionInfo } from "../../logic/competition";
import LoadingPage from "../../Components/LoadingPage";
import {
    Box,
    FormControl,
    FormLabel,
    Heading, Input,
    Select,
    Text,
} from "@chakra-ui/react";
import { Activity, Event, Room, Venue } from "@wca/helpers";
import ScheduleTable from "../../Components/Table/ScheduleTable";
import { getPrettyCompetitionEndDate } from "../../logic/utils";
import EventIcon from "../../Components/Icons/EventIcon";
import { useAtom } from "jotai";
import { competitionAtom } from "../../logic/atoms";
import { useNavigate } from "react-router-dom";

const Home = (): JSX.Element => {
    const navigate = useNavigate();
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [selectedVenue, setSelectedVenue] = useState<number>(0);
    const [selectedRoom, setSelectedRoom] = useState<number>(0);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const orderedActivities = useMemo(() => {
        if (!competition) {
            return [];
        }
        return competition.wcif.schedule.venues
            .find((venue: Venue) => venue.id === selectedVenue)
            ?.rooms.find((room: Room) => room.id === selectedRoom)
            ?.activities.filter((a: Activity) => {
                if (new Date(a.startTime).getDay() === selectedDate.getDay()) {
                    return true;
                }
            }).sort((a: Activity, b: Activity) => {
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
        if (new Date(response.data.wcif.schedule.startDate).getTime() > new Date().getTime()) {
            setSelectedDate(new Date(response.data.wcif.schedule.startDate));
        } else {
            setSelectedDate(new Date());
        }
        setSelectedRoom(response.data.wcif.schedule.venues[0].rooms[0].id);
    }, [navigate, setCompetition]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (!competition) {
        return <LoadingPage />;
    }

    return (
        <Box display="flex" flexDirection="column" gap="5">
            <Heading size="lg">{competition?.name}</Heading>
            {competition.wcif?.schedule.numberOfDays === 1 ? (
                <>
                    Date:{" "}
                    {new Date(
                        competition.wcif.schedule.startDate
                    ).toLocaleDateString()}
                </>
            ) : (
                <>
                    <Text>
                        Start date:{" "}
                        {new Date(
                            competition.wcif.schedule.startDate
                        ).toLocaleDateString()}
                    </Text>
                    <Text>
                        End date:{" "}
                        {getPrettyCompetitionEndDate(
                            competition.wcif.schedule.startDate,
                            competition.wcif.schedule.numberOfDays
                        )}
                    </Text>
                </>
            )}
            <Text>Competitor limit: {competition.wcif.competitorLimit}</Text>
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
            <Box display="flex" flexDirection="row" gap="5">
                <FormControl width="fit-content">
                    <FormLabel>Date</FormLabel>
                    <Input type="date" onChange={(e) => setSelectedDate(new Date(e.target.value))} value={selectedDate.toISOString().split('T')[0]} />
                </FormControl>
                <FormControl width="fit-content">
                    <FormLabel>Venue</FormLabel>
                    <Select
                        onChange={(e) =>
                            setSelectedVenue(parseInt(e.target.value))
                        }
                        value={selectedVenue}
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
                        value={selectedRoom}
                    >
                        {competition?.wcif.schedule.venues
                            .find((venue: Venue) => venue.id === selectedVenue)
                            ?.rooms.map((room: Room) => (
                                <option key={room.id} value={room.id}>
                                    {room.name}
                                </option>
                            ))}
                    </Select>
                </FormControl>
            </Box>
            {orderedActivities && orderedActivities.length > 0 ? (
                <ScheduleTable
                    activities={orderedActivities}
                    events={competition.wcif.events}
                />
            ) : (
                <Text>No activities</Text>
            )}
        </Box>
    );
};

export default Home;
