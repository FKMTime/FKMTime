import { Calendar1, ChevronLeft, ChevronRight } from "lucide-react";
import { Activity, Venue } from "wcif-helpers";

import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Competition } from "@/lib/interfaces";

import CompetitionDateSelect from "./CompetitionDateSelect";
import RoomSelect from "./RoomSelect";
import ScheduleTable from "./Schedule/ScheduleTable";
import VenueSelect from "./VenueSelect";

interface ScheduleInfoCardProps {
    competition: Competition;
    fetchActivitiesData: (
        selectedVenueId: number,
        selectedRoomId: number,
        date: Date
    ) => void;
    activities: Activity[];
    possibleDates: Date[];
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;
    selectedVenue: number;
    setSelectedVenue: (venueId: number) => void;
    selectedRoom: number;
    setSelectedRoom: (roomId: number) => void;
}
const ScheduleInfoCard = ({
    competition,
    fetchActivitiesData,
    activities,
    possibleDates,
    selectedDate,
    setSelectedDate,
    selectedVenue,
    setSelectedVenue,
    selectedRoom,
    setSelectedRoom,
}: ScheduleInfoCardProps) => {
    if (!competition) {
        return null;
    }

    const currentDateIndex = possibleDates.findIndex(
        (d) => d.toDateString() === selectedDate.toDateString()
    );
    const canGoPrev = currentDateIndex > 0;
    const canGoNext = currentDateIndex < possibleDates.length - 1;

    const changeDate = (date: Date) => {
        setSelectedDate(date);
        fetchActivitiesData(selectedVenue, selectedRoom, date);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex gap-2 items-center mb-3">
                    <Calendar1 size={20} />
                    Schedule
                </CardTitle>
                <div className="flex flex-col md:flex-row gap-5 items-start md:items-center">
                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={!canGoPrev}
                            onClick={() =>
                                changeDate(possibleDates[currentDateIndex - 1])
                            }
                        >
                            <ChevronLeft size={16} />
                        </Button>
                        <CompetitionDateSelect
                            onChange={(date) => changeDate(new Date(date))}
                            possibleDates={possibleDates}
                            selectedDate={selectedDate}
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={!canGoNext}
                            onClick={() =>
                                changeDate(possibleDates[currentDateIndex + 1])
                            }
                        >
                            <ChevronRight size={16} />
                        </Button>
                    </div>
                    <VenueSelect
                        venues={competition.wcif.schedule.venues}
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
                                (venue: Venue) => venue.id === selectedVenue
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
    );
};

export default ScheduleInfoCard;
