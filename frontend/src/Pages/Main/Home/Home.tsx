import { Venue } from "@wca/helpers";
import { useAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCompetitionDates } from "wcif-helpers";

import CompetitionStatistics from "@/Components/CompetitionStatistics/CompetitionStatistics";
import LoadingPage from "@/Components/LoadingPage";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { competitionAtom } from "@/lib/atoms";
import {
    getActivitiesWithRealEndTime,
    getCompetitionInfo,
} from "@/lib/competition";
import { Activity, Room } from "@/lib/interfaces";
import { isOrganizerOrDelegate } from "@/lib/permissions";
import { getAllRooms } from "@/lib/rooms";
import PageTransition from "@/Pages/PageTransition";

import CompetitionDateSelect from "./Components/CompetitionDateSelect";
import InfoCard from "./Components/InfoCard";
import RoomSelect from "./Components/RoomSelect";
import MobileSchedule from "./Components/Schedule/MobileSchedule";
import ScheduleTable from "./Components/Schedule/ScheduleTable";
import VenueSelect from "./Components/VenueSelect";

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
            fetchActivitiesData(selectedVenue, selectedRoom, selectedDate);
        });
    }, [selectedDate, selectedRoom, selectedVenue]);

    if (!competition || !rooms) {
        return <LoadingPage />;
    }

    return (
        <PageTransition>
            <div className="flex flex-col gap-5">
                {isOrganizerOrDelegate() && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-auto">
                        <InfoCard competition={competition} />
                        <div className="md:col-span-2 grid grid-cols-2 gap-4">
                            <CompetitionStatistics />
                        </div>
                    </div>
                )}
                {activities && activities.length > 0 ? (
                    <>
                        <div className="hidden md:block">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="mb-3">
                                        Schedule
                                    </CardTitle>
                                    <div className="flex flex-col md:flex-row gap-5">
                                        <CompetitionDateSelect
                                            onChange={(date) => {
                                                setSelectedDate(new Date(date));
                                                fetchActivitiesData(
                                                    selectedVenue,
                                                    selectedRoom,
                                                    new Date(date)
                                                );
                                            }}
                                            possibleDates={possibleDates}
                                            selectedDate={selectedDate}
                                        />
                                        <VenueSelect
                                            venues={
                                                competition.wcif.schedule.venues
                                            }
                                            selectedVenueId={selectedVenue.toString()}
                                            onChange={(id) => {
                                                setSelectedVenue(parseInt(id));
                                                fetchActivitiesData(
                                                    parseInt(id),
                                                    selectedRoom,
                                                    selectedDate
                                                );
                                            }}
                                        />
                                        <RoomSelect
                                            rooms={
                                                competition.wcif.schedule.venues.find(
                                                    (venue: Venue) =>
                                                        venue.id ===
                                                        selectedVenue
                                                )?.rooms || []
                                            }
                                            selectedRoomId={selectedRoom.toString()}
                                            onChange={(id) => {
                                                setSelectedRoom(parseInt(id));
                                                fetchActivitiesData(
                                                    selectedVenue,
                                                    parseInt(id),
                                                    selectedDate
                                                );
                                            }}
                                        />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <ScheduleTable
                                        activities={activities}
                                        events={competition.wcif.events}
                                    />
                                </CardContent>
                            </Card>
                        </div>
                        <div className="block md:hidden">
                            <MobileSchedule activities={activities} />
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
