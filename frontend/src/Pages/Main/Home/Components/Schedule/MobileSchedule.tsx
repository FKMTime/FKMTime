import { ChevronLeft, ChevronRight } from "lucide-react";
import { Venue } from "wcif-helpers";

import { Button } from "@/Components/ui/button";
import { Activity, Competition } from "@/lib/interfaces";

import CompetitionDateSelect from "../CompetitionDateSelect";
import RoomSelect from "../RoomSelect";
import VenueSelect from "../VenueSelect";
import ScheduleCard from "./ScheduleCard";

interface MobileScheduleProps {
    activities: Activity[];
    competition: Competition;
    possibleDates: Date[];
    selectedDate: Date;
    selectedVenue: number;
    selectedRoom: number;
    onDateChange: (date: Date) => void;
    onVenueChange: (id: number) => void;
    onRoomChange: (id: number) => void;
}

const MobileSchedule = ({
    activities,
    competition,
    possibleDates,
    selectedDate,
    selectedVenue,
    selectedRoom,
    onDateChange,
    onVenueChange,
    onRoomChange,
}: MobileScheduleProps) => {
    const currentDateIndex = possibleDates.findIndex(
        (d) => d.toDateString() === selectedDate.toDateString()
    );
    const canGoPrev = currentDateIndex > 0;
    const canGoNext = currentDateIndex < possibleDates.length - 1;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-1">
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        disabled={!canGoPrev}
                        onClick={() =>
                            onDateChange(possibleDates[currentDateIndex - 1])
                        }
                    >
                        <ChevronLeft size={16} />
                    </Button>
                    <CompetitionDateSelect
                        onChange={(date) => onDateChange(new Date(date))}
                        possibleDates={possibleDates}
                        selectedDate={selectedDate}
                    />
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        disabled={!canGoNext}
                        onClick={() =>
                            onDateChange(possibleDates[currentDateIndex + 1])
                        }
                    >
                        <ChevronRight size={16} />
                    </Button>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <VenueSelect
                        venues={competition.wcif.schedule.venues}
                        selectedVenueId={selectedVenue.toString()}
                        onChange={(id) => onVenueChange(parseInt(id))}
                    />
                    <RoomSelect
                        rooms={
                            competition.wcif.schedule.venues.find(
                                (venue: Venue) => venue.id === selectedVenue
                            )?.rooms || []
                        }
                        selectedRoomId={selectedRoom.toString()}
                        onChange={(id) => onRoomChange(parseInt(id))}
                    />
                </div>
            </div>
            {activities.map((activity: Activity) => (
                <ScheduleCard
                    key={activity.id}
                    activity={activity}
                    competition={competition}
                />
            ))}
        </div>
    );
};

export default MobileSchedule;
