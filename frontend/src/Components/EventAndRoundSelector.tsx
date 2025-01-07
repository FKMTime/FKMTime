import { Event, Round } from "@wca/helpers";

import EventIcon from "@/Components/Icons/EventIcon";
import { Competition } from "@/lib/interfaces";

import IconButton from "./IconButton";
import { Label } from "./ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";

interface EventAndRoundSelectorProps {
    competition: Competition;
    filters: {
        eventId: string;
        roundId: string;
    };
    showLabel?: boolean;
    handleEventChange: (eventId: string) => void;
    handleRoundChange: (roundId: string) => void;
}

const EventAndRoundSelector = ({
    competition,
    filters,
    showLabel,
    handleEventChange,
    handleRoundChange,
}: EventAndRoundSelectorProps) => {
    return (
        <>
            <div className="flex gap-5 flex-wrap w-full">
                {competition.wcif.events.map((event: Event) => (
                    <IconButton
                        key={event.id}
                        aria-label={event.id}
                        icon={
                            <EventIcon
                                eventId={event.id}
                                selected={filters.eventId === event.id}
                                size={20}
                            />
                        }
                        onClick={() => handleEventChange(event.id)}
                        className="flex items-center justify-center"
                    />
                ))}
            </div>
            {filters.eventId && (
                <div>
                    {showLabel && <Label>Round</Label>}
                    <div className="w-24">
                        <Select
                            value={filters.roundId}
                            onValueChange={(value) => handleRoundChange(value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select round" />
                            </SelectTrigger>
                            <SelectContent>
                                {competition.wcif.events
                                    .find(
                                        (event: Event) =>
                                            event.id === filters.eventId
                                    )
                                    ?.rounds.map((round: Round, i: number) => (
                                        <SelectItem
                                            key={round.id}
                                            value={round.id}
                                        >
                                            Round {i + 1}
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}
        </>
    );
};

export default EventAndRoundSelector;
