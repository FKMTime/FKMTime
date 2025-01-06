import { Activity, Event, Round } from "@wca/helpers";
import { useMemo, useState } from "react";

import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Label } from "@/Components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import { getGroupsByRoundId } from "@/lib/activities";
import { getEventName } from "@/lib/events";
import { Competition, Room } from "@/lib/interfaces";

interface RoomCardProps {
    room: Room;
    currentGroupId: string;
    updateCurrentGroup: (room: Room) => void;
    competition: Competition;
}

const RoomCard = ({
    room,
    currentGroupId,
    updateCurrentGroup,
    competition,
}: RoomCardProps) => {
    const [currentEvent, setCurrentEvent] = useState<string>(
        currentGroupId ? currentGroupId.split("-")[0] : ""
    );
    const [currentRound, setCurrentRound] = useState<string>(
        currentGroupId ? currentGroupId.split("-g")[0] : ""
    );
    const groups = useMemo(() => {
        if (
            !competition ||
            !currentRound ||
            !currentEvent ||
            currentEvent === ""
        ) {
            return [];
        }
        return getGroupsByRoundId(currentRound, competition.wcif);
    }, [competition, currentEvent, currentRound]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>{room.name}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-2 mb-3">
                    <Label>Event</Label>
                    <Select
                        onValueChange={(value) => {
                            if (value === "" || value === "NONE") {
                                setCurrentEvent("");
                                setCurrentRound("");
                                updateCurrentGroup({
                                    ...room,
                                    currentGroupId: "",
                                });
                                return;
                            }
                            setCurrentEvent(value);
                            setCurrentRound(value + "-r1");
                            updateCurrentGroup({
                                ...room,
                                currentGroupId: value + "-r1-g1",
                            });
                        }}
                        value={currentEvent}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select event" />
                        </SelectTrigger>
                        <SelectContent>
                            {competition.wcif.events.map((event: Event) => (
                                <SelectItem key={event.id} value={event.id}>
                                    {getEventName(event.id)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {currentEvent && (
                    <div className="flex flex-col gap-2 mb-3">
                        <Label>Round</Label>
                        <Select
                            onValueChange={(value) => {
                                setCurrentRound(value);
                                updateCurrentGroup({
                                    ...room,
                                    currentGroupId: value + "-g1",
                                });
                            }}
                            value={currentRound}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select round" />
                            </SelectTrigger>

                            <SelectContent>
                                {competition.wcif.events
                                    .find(
                                        (event: Event) =>
                                            event.id === currentEvent
                                    )
                                    ?.rounds.map((round: Round, i: number) => (
                                        <SelectItem
                                            key={round.id}
                                            value={round.id}
                                        >
                                            {i + 1}
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                {currentRound && (
                    <div className="flex flex-col gap-2 mb-3">
                        <Label>Group</Label>
                        <Select
                            onValueChange={(value) => {
                                updateCurrentGroup({
                                    ...room,
                                    currentGroupId: value,
                                });
                            }}
                            value={currentGroupId}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select group" />
                            </SelectTrigger>

                            <SelectContent>
                                {groups.map((group: Activity, i: number) => (
                                    <SelectItem
                                        key={group.activityCode}
                                        value={group.activityCode}
                                    >
                                        {i + 1}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => {
                        setCurrentEvent("");
                        setCurrentRound("");
                        updateCurrentGroup({
                            ...room,
                            currentGroupId: "",
                        });
                    }}
                >
                    Clear
                </Button>
            </CardContent>
        </Card>
    );
};

export default RoomCard;
