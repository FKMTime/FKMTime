import { Activity, Event, Round } from "@wca/helpers";
import { useMemo, useState } from "react";

import { Button } from "@/Components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import { TableCell, TableRow } from "@/Components/ui/table";
import { getGroupsByRoundId } from "@/lib/activities";
import { getEventName } from "@/lib/events";
import { Competition, Room } from "@/lib/interfaces";

interface RoomRowProps {
    competition: Competition;
    room: Room;
    updateCurrentGroup: (room: Room) => void;
}

const RoomRow = ({ competition, room, updateCurrentGroup }: RoomRowProps) => {
    const [currentEvent, setCurrentEvent] = useState<string>(
        room.currentGroupId ? room.currentGroupId.split("-")[0] : ""
    );
    const [currentRound, setCurrentRound] = useState<string>(
        room.currentGroupId ? room.currentGroupId.split("-g")[0] : ""
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
        <TableRow>
            <TableCell>{room.name}</TableCell>
            <TableCell>
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
            </TableCell>
            <TableCell>
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
                            .find((event: Event) => event.id === currentEvent)
                            ?.rounds.map((round: Round, i: number) => (
                                <SelectItem key={round.id} value={round.id}>
                                    {i + 1}
                                </SelectItem>
                            ))}
                    </SelectContent>
                </Select>
            </TableCell>
            <TableCell>
                <Select
                    onValueChange={(value) => {
                        updateCurrentGroup({
                            ...room,
                            currentGroupId: value,
                        });
                    }}
                    value={room.currentGroupId}
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
            </TableCell>
            <TableCell>
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
            </TableCell>
        </TableRow>
    );
};

export default RoomRow;
