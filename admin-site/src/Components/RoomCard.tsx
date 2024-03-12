import {Room, Competition} from "../logic/interfaces.ts";
import {Box, FormControl, FormLabel, Heading, Select} from "@chakra-ui/react";
import {useMemo, useState} from "react";
import {Activity, Event, Round} from "@wca/helpers";
import events from "../logic/events.ts";

interface RoomCardProps {
    room: Room;
    currentGroupId: string;
    updateCurrentGroup: (room: Room) => void;
    competition: Competition;
}

const RoomCard: React.FC<RoomCardProps> = ({room, currentGroupId, updateCurrentGroup, competition}) => {

    const [currentEvent, setCurrentEvent] = useState<string>(currentGroupId ? currentGroupId.split("-")[0] : "");
    const [currentRound, setCurrentRound] = useState<string>(currentGroupId ? currentGroupId.split("-g")[0] : "");
    const groups = useMemo(() => {
        if (
            !competition ||
            !currentRound ||
            !competition.wcif.schedule.venues[0].rooms[0].activities ||
            !currentEvent ||
            currentEvent === ""
        ) {
            return [];
        }
        //eslint-disable-next-line
        //@ts-ignore
        return competition.wcif.schedule.venues[0].rooms.find((r) => r.name === room.name).activities.find(
            (activity: Activity) => activity.activityCode === currentRound
        ).childActivities;
    }, [competition, currentEvent, currentRound, room.name]);

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
                    placeholder="Select event"
                    _placeholder={{color: "white"}}
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
                        placeholder="Select round"
                        _placeholder={{color: "white"}}
                        value={currentRound}
                        onChange={(event) =>
                            setCurrentRound(event?.target.value)
                        }
                    >
                        {competition.wcif.events
                            .find(
                                (event: Event) => event.id === currentEvent
                            )
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
                        placeholder="Select group"
                        _placeholder={{color: "white"}}
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