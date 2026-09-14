import { useAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCompetitionDates } from "wcif-helpers";

import CompetitionStatistics from "@/Components/CompetitionStatistics/CompetitionStatistics";
import LoadingPage from "@/Components/LoadingPage";
import { competitionAtom } from "@/lib/atoms";
import {
    getActivitiesWithRealEndTime,
    getCompetitionInfo,
} from "@/lib/competition";
import { Activity, Room } from "@/lib/interfaces";
import { isDelegate, isOrganizerOrDelegate } from "@/lib/permissions";
import { getAllRooms } from "@/lib/rooms";
import PageTransition from "@/Pages/PageTransition";

import HomeIncidentsCard from "./Components/HomeIncidentsCard";
import NextGroupCard from "./Components/NextGroupCard";
import OngoingRoundCard from "./Components/OngoingRoundCard";
import MobileSchedule from "./Components/Schedule/MobileSchedule";
import ScheduleInfoCard from "./Components/ScheduleInfoCard";

const Home = () => {
    const navigate = useNavigate();
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [rooms, setRooms] = useState<Room[]>([]);
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

    const fetchRooms = useCallback(async () => {
        const data = await getAllRooms();
        setRooms(data);
    }, []);

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
        fetchRooms().then(() => {
            fetchActivitiesData(selectedVenue, selectedRoom, selectedDate);
        });
    }, [selectedDate, selectedRoom, selectedVenue, fetchRooms]);

    if (!competition || !rooms) {
        return <LoadingPage />;
    }

    const ongoingRoundIds = [
        ...new Set(
            rooms.flatMap((room) =>
                room.currentGroupIds.map((gid) => gid.split("-g")[0])
            )
        ),
    ].filter(Boolean);

    const showNextGroup = isOrganizerOrDelegate() && rooms.length > 0;
    const showIncidents = isDelegate();
    const hasOngoingRounds =
        isOrganizerOrDelegate() && ongoingRoundIds.length > 0;
    // Merge round cards into the top row when there are 1–2 rounds and at least one top card
    const mergeTopRow =
        hasOngoingRounds &&
        ongoingRoundIds.length <= 2 &&
        (showNextGroup || showIncidents);

    const topCardCount =
        (showNextGroup ? 1 : 0) +
        (showIncidents ? 1 : 0) +
        (mergeTopRow ? ongoingRoundIds.length : 0);

    const topGridCols =
        topCardCount === 4
            ? "md:grid-cols-4"
            : topCardCount === 3
              ? "md:grid-cols-3"
              : topCardCount === 2
                ? "md:grid-cols-2"
                : "";

    return (
        <PageTransition>
            <div className="flex flex-col gap-4">
                {(showNextGroup || showIncidents || mergeTopRow) && (
                    <div className={`grid grid-cols-1 gap-4 ${topGridCols}`}>
                        {showNextGroup && (
                            <NextGroupCard
                                rooms={rooms}
                                onGroupSwitched={fetchRooms}
                            />
                        )}
                        {showIncidents && <HomeIncidentsCard />}
                        {mergeTopRow &&
                            ongoingRoundIds.map((roundId) => (
                                <OngoingRoundCard
                                    key={roundId}
                                    roundId={roundId}
                                    rooms={rooms}
                                    onGroupSwitched={fetchRooms}
                                />
                            ))}
                    </div>
                )}

                {!mergeTopRow && hasOngoingRounds && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {ongoingRoundIds.map((roundId) => (
                            <OngoingRoundCard
                                key={roundId}
                                roundId={roundId}
                                rooms={rooms}
                                onGroupSwitched={fetchRooms}
                            />
                        ))}
                    </div>
                )}

                {isOrganizerOrDelegate() && competition.useFkmTimeDevices && (
                    <CompetitionStatistics combined />
                )}

                {activities && activities.length > 0 ? (
                    <>
                        <div className="hidden md:block">
                            <ScheduleInfoCard
                                competition={competition}
                                fetchActivitiesData={fetchActivitiesData}
                                activities={activities}
                                possibleDates={possibleDates}
                                selectedDate={selectedDate}
                                setSelectedDate={setSelectedDate}
                                selectedVenue={selectedVenue}
                                setSelectedVenue={setSelectedVenue}
                                selectedRoom={selectedRoom}
                                setSelectedRoom={setSelectedRoom}
                            />
                        </div>
                        <div className="block md:hidden">
                            <MobileSchedule
                                activities={activities}
                                competition={competition}
                                possibleDates={possibleDates}
                                selectedDate={selectedDate}
                                selectedVenue={selectedVenue}
                                selectedRoom={selectedRoom}
                                onDateChange={(date) => {
                                    setSelectedDate(date);
                                    fetchActivitiesData(
                                        selectedVenue,
                                        selectedRoom,
                                        date
                                    );
                                }}
                                onVenueChange={(id) => {
                                    setSelectedVenue(id);
                                    fetchActivitiesData(
                                        id,
                                        selectedRoom,
                                        selectedDate
                                    );
                                }}
                                onRoomChange={(id) => {
                                    setSelectedRoom(id);
                                    fetchActivitiesData(
                                        selectedVenue,
                                        id,
                                        selectedDate
                                    );
                                }}
                            />
                        </div>
                    </>
                ) : (
                    <p>No activities</p>
                )}
            </div>
        </PageTransition>
    );
};

export default Home;
