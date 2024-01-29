import { useEffect, useMemo, useState } from "react";
import { Competition } from "../../logic/interfaces";
import { getCompetitionInfo } from "../../logic/competition";
import LoadingPage from "../../Components/LoadingPage";
import { Box, FormControl, FormLabel, Heading, Select, Text } from "@chakra-ui/react";
import { Activity, Event, Room, Venue } from "@wca/helpers";
import ScheduleTable from "../../Components/Table/ScheduleTable";
import { getPrettyCompetitionEndDate } from "../../logic/utils";
import EventIcon from "../../Components/Icons/EventIcon";

const Home = (): JSX.Element => {
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<number>(0);
  const [selectedRoom, setSelectedRoom] = useState<number>(0);
  const orderedActivities = useMemo(() => {
    if (!competition) {
      return [];
    }
    return competition.wcif.schedule.venues
      .find((venue: Venue) => venue.id === selectedVenue)
      ?.rooms.find((room: Room) => room.id === selectedRoom)
      ?.activities.sort((a: Activity, b: Activity) => {
        if (new Date(a.startTime).getTime() < new Date(b.startTime).getTime()) {
          return -1;
        }
        if (new Date(a.startTime).getTime() > new Date(b.startTime).getTime()) {
          return 1;
        }
        return 0;
      });
  }, [competition, selectedVenue, selectedRoom]);

  const fetchData = async () => {
    const response = await getCompetitionInfo();
    setCompetition(response.data);
    setSelectedVenue(response.data.wcif.schedule.venues[0].id);
    setSelectedRoom(response.data.wcif.schedule.venues[0].rooms[0].id);
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (!competition) {
    return <LoadingPage />;
  }

  return (
    <Box display="flex" flexDirection="column" gap="5">
      <Heading size="lg">{competition?.name}</Heading>
      {competition.wcif.schedule.numberOfDays === 1 ? (
        <>Date: {new Date(competition.wcif.schedule.startDate).toLocaleDateString()}</>
      ) : (
        <>
          <Text>Start date: {new Date(competition.wcif.schedule.startDate).toLocaleDateString()}</Text>
          <Text>End date: {getPrettyCompetitionEndDate(competition.wcif.schedule.startDate, competition.wcif.schedule.numberOfDays)}</Text>
        </>
      )}
      <Text>Competitor limit: {competition.wcif.competitorLimit}</Text>
      <Box display="flex" flexDirection="row" gap="5" width="20%">
        {competition.wcif.events.map((event: Event) => (
          <EventIcon key={event.id} eventId={event.id} selected={true} size={25} />
        ))}
      </Box>
      <Box display="flex" flexDirection="row" gap="5" width="20%">
        <FormControl>
          <FormLabel>Venue</FormLabel>
          <Select onChange={(e) => setSelectedVenue(parseInt(e.target.value))} value={selectedVenue}>
            {competition?.wcif.schedule.venues.map((venue: Venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
              </option>
            ))}
          </Select>
        </FormControl>
        <FormControl>
          <FormLabel>Room</FormLabel>
          {competition?.wcif.schedule.venues
            .find((venue: Venue) => venue.id === selectedVenue)
            ?.rooms.map((room: Room) => (
              <Select onChange={(e) => setSelectedRoom(parseInt(e.target.value))} value={selectedRoom}>
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              </Select>
            ))}
        </FormControl>
      </Box>
      {orderedActivities && orderedActivities.length > 0 ?
        <ScheduleTable activities={orderedActivities} events={competition.wcif.events} /> : <Text>No activities in this room</Text>}
    </Box>
  )
};

export default Home;
