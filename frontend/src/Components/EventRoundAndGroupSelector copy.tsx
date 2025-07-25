import { Activity, Event, Round } from "@wca/helpers";
import { useMemo } from "react";

import EventIcon from "@/Components/Icons/EventIcon";
import { getGroupsByRoundId } from "@/lib/activities";
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

interface EventRoundAndGroupSelectorProps {
    competition: Competition;
    filters: {
        eventId: string;
        roundId: string;
        groupId: string;
    };
    showLabel?: boolean;
    handleEventChange: (eventId: string) => void;
    handleRoundChange: (roundId: string) => void;
    handleGroupChange: (groupId: string) => void;
}

const EventRoundAndGroupSelector = ({
    competition,
    filters,
    showLabel,
    handleEventChange,
    handleRoundChange,
    handleGroupChange,
}: EventRoundAndGroupSelectorProps) => {
    const groups = useMemo(() => {
        if (
            !competition ||
            !filters.roundId ||
            !filters.eventId ||
            filters.eventId === ""
        ) {
            return [];
        }
        return getGroupsByRoundId(filters.roundId, competition.wcif);
    }, [competition, filters.roundId, filters.eventId]);
    return (
        <div className="flex flex-col md:flex-row md:justify-between gap-4">
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
            <div className="flex gap-4">
                {filters.eventId && (
                    <div>
                        {showLabel && <Label>Round</Label>}
                        <div className="w-24">
                            <Select
                                value={filters.roundId}
                                onValueChange={(value) =>
                                    handleRoundChange(value)
                                }
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
                                        ?.rounds.map(
                                            (round: Round, i: number) => (
                                                <SelectItem
                                                    key={round.id}
                                                    value={round.id}
                                                >
                                                    Round {i + 1}
                                                </SelectItem>
                                            )
                                        )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}
                {filters.roundId && (
                    <div>
                        {showLabel && <Label>Group</Label>}
                        <div className="w-24">
                            <Select
                                value={filters.groupId}
                                onValueChange={(value) =>
                                    handleGroupChange(value)
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select group" />
                                </SelectTrigger>
                                <SelectContent>
                                    {groups.map((group: Activity) => (
                                        <SelectItem
                                            key={group.activityCode}
                                            value={group.activityCode}
                                        >
                                            Group{" "}
                                            {group.activityCode.split("-g")[1]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EventRoundAndGroupSelector;
