import { useEffect, useMemo, useState } from "react";
import { Attendance as AttendanceType, Room } from "../../logic/interfaces";
import {
    Box,
    FormControl,
    FormLabel,
    Heading,
    ListItem,
    Select,
    UnorderedList,
} from "@chakra-ui/react";
import { Activity, Event, Room as WCIFRoom, Round } from "@wca/helpers";
import { getCompetitionInfo } from "../../logic/competition.ts";
import { competitionAtom } from "../../logic/atoms.ts";
import { useAtom } from "jotai";
import events from "../../logic/events.ts";
import LoadingPage from "../../Components/LoadingPage.tsx";
import { getAllRooms } from "../../logic/rooms.ts";
import { getAttendanceByGroupId } from "../../logic/attendance.ts";
import { getAbsentPeople } from "../../logic/utils.ts";

const Attendance = () => {
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [attendance, setAttendance] = useState<AttendanceType[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);

    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<string>("");
    const [selectedRound, setSelectedRound] = useState<string>("");
    const [selectedGroup, setSelectedGroup] = useState<string>("");
    const groups = useMemo(() => {
        if (
            !competition ||
            !selectedRound ||
            !competition.wcif.schedule.venues[0].rooms[0].activities ||
            !selectedRoom ||
            !selectedEvent ||
            selectedEvent === ""
        ) {
            return [];
        }
        //eslint-disable-next-line
        //@ts-ignore
        return competition.wcif.schedule.venues[0].rooms
            .find((r: WCIFRoom) => r.name === selectedRoom.name)
            .activities.find(
                (activity: Activity) => activity.activityCode === selectedRound
            ).childActivities;
    }, [competition, selectedRound, selectedRoom, selectedEvent]);
    const presentScramblers = useMemo(() => {
        return attendance.filter((a) => a.role === "SCRAMBLER");
    }, [attendance]);
    const presentRunners = useMemo(() => {
        return attendance.filter((a) => a.role === "RUNNER");
    }, [attendance]);
    const presentJudges = useMemo(() => {
        return attendance.filter((a) => a.role === "JUDGE");
    }, [attendance]);

    const absentScramblers = useMemo(() => {
        if (!competition) return [];
        return getAbsentPeople(
            competition.wcif,
            presentScramblers,
            selectedRoom?.name || "",
            selectedGroup,
            "SCRAMBLER"
        );
    }, [competition, presentScramblers, selectedRoom?.name, selectedGroup]);

    const absentRunners = useMemo(() => {
        if (!competition) return [];
        return getAbsentPeople(
            competition.wcif,
            presentRunners,
            selectedRoom?.name || "",
            selectedGroup,
            "RUNNER"
        );
    }, [competition, presentRunners, selectedRoom?.name, selectedGroup]);

    const absentJudges = useMemo(() => {
        if (!competition) return [];
        return getAbsentPeople(
            competition.wcif,
            presentJudges,
            selectedRoom?.name || "",
            selectedGroup,
            "JUDGE"
        );
    }, [competition, presentJudges, selectedRoom?.name, selectedGroup]);

    useEffect(() => {
        getAllRooms().then((rooms: Room[]) => {
            setRooms(rooms);
        });
    }, []);

    useEffect(() => {
        if (!competition) {
            getCompetitionInfo().then((response) => {
                setCompetition(response.data);
            });
        }
    }, [competition, setCompetition]);

    const handleGroupChange = async (
        event: React.ChangeEvent<HTMLSelectElement>
    ) => {
        setSelectedGroup(event.target.value);
        const data = await getAttendanceByGroupId(event.target.value);
        setAttendance(data);
    };

    if (!competition) {
        return <LoadingPage />;
    }

    return (
        <Box display="flex" flexDirection="column" gap="5">
            <Heading size="lg">Attendance</Heading>
            <Box display="flex" gap="2">
                <FormControl width="fit-content">
                    <FormLabel>Room</FormLabel>
                    <Select
                        placeholder="Select room"
                        _placeholder={{ color: "white" }}
                        value={selectedRoom?.id}
                        onChange={(event) => {
                            setSelectedRoom(
                                rooms.find(
                                    (room) => room.id === event?.target.value
                                ) || null
                            );
                        }}
                    >
                        {rooms.map((room: Room) => (
                            <option key={room.id} value={room.id}>
                                {room.name}
                            </option>
                        ))}
                    </Select>
                </FormControl>
                {selectedRoom && (
                    <>
                        <FormControl width="fit-content">
                            <FormLabel>Event</FormLabel>
                            <Select
                                placeholder="Select event"
                                _placeholder={{ color: "white" }}
                                value={selectedEvent}
                                onChange={(event) => {
                                    setSelectedEvent(event?.target.value);
                                    setSelectedRound(
                                        event?.target.value + "-r1"
                                    );
                                }}
                            >
                                {competition.wcif.events.map((event: Event) => (
                                    <option key={event.id} value={event.id}>
                                        {
                                            events.find(
                                                (e) => e.id === event.id
                                            )?.name
                                        }
                                    </option>
                                ))}
                            </Select>
                        </FormControl>
                        {selectedEvent && (
                            <FormControl width="fit-content">
                                <FormLabel>Round</FormLabel>
                                <Select
                                    placeholder="Select round"
                                    _placeholder={{ color: "white" }}
                                    value={selectedRound}
                                    onChange={(event) =>
                                        setSelectedRound(event?.target.value)
                                    }
                                >
                                    {competition.wcif.events
                                        .find(
                                            (event: Event) =>
                                                event.id === selectedEvent
                                        )
                                        ?.rounds.map(
                                            (round: Round, i: number) => (
                                                <option
                                                    key={round.id}
                                                    value={round.id}
                                                >
                                                    {i + 1}
                                                </option>
                                            )
                                        )}
                                </Select>
                            </FormControl>
                        )}
                        {selectedRound && (
                            <FormControl width="fit-content">
                                <FormLabel>Group</FormLabel>
                                <Select
                                    placeholder="Select group"
                                    _placeholder={{ color: "white" }}
                                    value={selectedGroup}
                                    onChange={handleGroupChange}
                                >
                                    {groups.map(
                                        (group: Activity, i: number) => (
                                            <option
                                                key={group.activityCode}
                                                value={group.activityCode}
                                            >
                                                {i + 1}
                                            </option>
                                        )
                                    )}
                                </Select>
                            </FormControl>
                        )}
                    </>
                )}
            </Box>
            {attendance.length > 0 && (
                <>
                    <Box gap="5" display="flex" flexDirection="column">
                        <Heading>Scramblers</Heading>
                        <Heading size="md">Present</Heading>
                        <UnorderedList>
                            {presentScramblers.map((s) => (
                                <ListItem key={s.id}>{s.person.name}</ListItem>
                            ))}
                        </UnorderedList>
                        <Heading size="md">Absent</Heading>
                        <UnorderedList>
                            {absentScramblers.map((s) => (
                                <ListItem key={s.registrantId}>
                                    {s.name}
                                </ListItem>
                            ))}
                        </UnorderedList>
                    </Box>
                    <Box gap="5" display="flex" flexDirection="column">
                        <Heading>Runners</Heading>
                        <Heading size="md">Present</Heading>
                        <UnorderedList>
                            {presentRunners.map((s) => (
                                <ListItem key={s.id}>{s.person.name}</ListItem>
                            ))}
                        </UnorderedList>
                        <Heading size="md">Absent</Heading>
                        <UnorderedList>
                            {absentRunners.map((s) => (
                                <ListItem key={s.registrantId}>
                                    {s.name}
                                </ListItem>
                            ))}
                        </UnorderedList>
                    </Box>
                    <Box gap="5" display="flex" flexDirection="column">
                        <Heading>Judges</Heading>
                        <Heading size="md">Present</Heading>
                        <UnorderedList>
                            {presentJudges.map((s) => (
                                <ListItem key={s.id}>
                                    {s.person.name} - station {s.device.name}
                                </ListItem>
                            ))}
                        </UnorderedList>
                        <Heading size="md">Absent</Heading>
                        <UnorderedList>
                            {absentJudges.map((s) => (
                                <ListItem key={s.registrantId}>
                                    {s.name}
                                </ListItem>
                            ))}
                        </UnorderedList>
                    </Box>
                </>
            )}
        </Box>
    );
};

export default Attendance;
