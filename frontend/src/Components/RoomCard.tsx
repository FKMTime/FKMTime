import { Room, Competition } from "../logic/interfaces.ts";
import { Box, FormControl, FormLabel, Heading } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { Activity, Event, Round } from "@wca/helpers";
import events from "../logic/events.ts";
import { getGroupsByRoundId } from "../logic/activities.ts";
import Select from "./Select.tsx";

interface RoomCardProps {
    room: Room;
    currentGroupId: string;
    updateCurrentGroup: (room: Room) => void;
    competition: Competition;
}

const RoomCard: React.FC<RoomCardProps> = ({
    room,
    currentGroupId,
    updateCurrentGroup,
    competition,
}) => {
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
        <Box
            key={room.id}
            border="1px"
            p="3"
            borderColor="gray.200"
            width="fit-content"
        >
            <Heading size="md">{room.name}</Heading>
            <FormControl>
                <FormLabel>Current event</FormLabel>
                <Select
                    value={currentEvent}
                    onChange={(event) => {
                        setCurrentEvent(event?.target.value);
                        setCurrentRound(event?.target.value + "-r1");
                    }}
                >
                    {competition.wcif.events.map((event: Event) => (
                        <option key={event.id} value={event.id}>
                            {events.find((e) => e.id === event.id)?.name}
                        </option>
                    ))}
                </Select>
            </FormControl>
            {currentEvent && (
                <FormControl>
                    <FormLabel>Current round</FormLabel>
                    <Select
                        value={currentRound}
                        onChange={(event) =>
                            setCurrentRound(event?.target.value)
                        }
                    >
                        {competition.wcif.events
                            .find((event: Event) => event.id === currentEvent)
                            ?.rounds.map((round: Round, i: number) => (
                                <option key={round.id} value={round.id}>
                                    {i + 1}
                                </option>
                            ))}
                    </Select>
                </FormControl>
            )}
            {currentRound && (
                <FormControl>
                    <FormLabel>Current group</FormLabel>
                    <Select
                        value={currentGroupId}
                        onChange={(event) =>
                            updateCurrentGroup({
                                ...room,
                                currentGroupId: event?.target.value,
                            })
                        }
                    >
                        {groups.map((group: Activity, i: number) => (
                            <option
                                key={group.activityCode}
                                value={group.activityCode}
                            >
                                {i + 1}
                            </option>
                        ))}
                    </Select>
                </FormControl>
            )}
        </Box>
    );
};

export default RoomCard;
