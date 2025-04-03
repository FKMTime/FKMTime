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
import { isOrganizerOrDelegate } from "@/lib/permissions";
import { getAllRooms } from "@/lib/rooms";
import PageTransition from "@/Pages/PageTransition";

import InfoCard from "./Components/InfoCard";
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
