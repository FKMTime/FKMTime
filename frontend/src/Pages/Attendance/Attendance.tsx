import { useEffect, useMemo, useState } from "react";
import { Attendance as AttendanceType, Room } from "../../logic/interfaces";
import {
    Box,
    Button,
    FormControl,
    FormLabel,
    Heading,
    Select,
    useToast,
} from "@chakra-ui/react";
import { Activity, Event, Room as WCIFRoom, Round } from "@wca/helpers";
import { getCompetitionInfo } from "../../logic/competition.ts";
import { competitionAtom } from "../../logic/atoms.ts";
import { useAtom } from "jotai";
import events from "../../logic/events.ts";
import LoadingPage from "../../Components/LoadingPage.tsx";
import { getAllRooms } from "../../logic/rooms.ts";
import {
    getAttendanceByGroupId,
    markAsPresent,
} from "../../logic/attendance.ts";
import { getAbsentPeople, getActivityNameByCode } from "../../logic/utils.ts";
import { useNavigate, useParams } from "react-router-dom";
import AbsentPeopleList from "../../Components/AbsentPeopleList.tsx";
import PresentPeopleList from "../../Components/PresentPeopleList.tsx";

const Attendance = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const toast = useToast();
    const selectedGroup = id ? id : "";
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [attendance, setAttendance] = useState<AttendanceType[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);

    const [selectedEvent, setSelectedEvent] = useState<string>("");
    const [selectedRound, setSelectedRound] = useState<string>("");
    const groups = useMemo(() => {
        if (
            !competition ||
            !selectedRound ||
            !competition.wcif.schedule.venues[0].rooms[0].activities ||
            !selectedEvent ||
            selectedEvent === ""
        ) {
            return [];
        }
        //eslint-disable-next-line
        //@ts-ignore
        let activitiesToReturn: Activity[] = [];
        competition.wcif.schedule.venues[0].rooms.forEach((room: WCIFRoom) => {
            room.activities.forEach((activity: Activity) => {
                if (activity.activityCode === selectedRound) {
                    activitiesToReturn = activity.childActivities;
                }
            });
        });
        return activitiesToReturn;
    }, [competition, selectedRound, selectedEvent]);
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
            selectedGroup,
            "SCRAMBLER"
        );
    }, [competition, presentScramblers, selectedGroup]);

    const absentRunners = useMemo(() => {
        if (!competition) return [];
        return getAbsentPeople(
            competition.wcif,
            presentRunners,
            selectedGroup,
            "RUNNER"
        );
    }, [competition, presentRunners, selectedGroup]);

    const absentJudges = useMemo(() => {
        if (!competition) return [];
        return getAbsentPeople(
            competition.wcif,
            presentJudges,
            selectedGroup,
            "JUDGE"
        );
    }, [competition, presentJudges, selectedGroup]);

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

    const fetchAttendanceData = async (groupId: string) => {
        const data = await getAttendanceByGroupId(groupId);
        setAttendance(data);
    };

    const handleGroupChange = (groupId: string) => {
        navigate(`/attendance/${groupId}`);
    };

    const handleMarkAsPresent = async (registrantId: number, role: string) => {
        const status = await markAsPresent(selectedGroup, registrantId, role);
        if (status === 201) {
            toast({
                title: "Success",
                description: "Marked as present",
                status: "success",
                duration: 3000,
                isClosable: true,
            });
            fetchAttendanceData(selectedGroup);
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        }
    };

    useEffect(() => {
        if (selectedGroup) {
            setSelectedEvent(selectedGroup.split("-")[0]);
            setSelectedRound(selectedGroup.split("-g")[0]);
            fetchAttendanceData(selectedGroup);
        }
    }, [rooms, selectedGroup]);

    if (!competition) {
        return <LoadingPage />;
    }

    return (
        <Box display="flex" flexDirection="column" gap="5">
            <Heading size="lg">Attendance</Heading>
            <Heading size="md">Current groups</Heading>
            <Box display="flex" gap="2">
                {rooms
                    .filter((r) => r.currentGroupId)
                    .map((room: Room) => (
                        <Button
                            key={room.id}
                            colorScheme="blue"
                            onClick={() => {
                                setSelectedEvent(
                                    room.currentGroupId.split("-")[0]
                                );
                                setSelectedRound(
                                    room.currentGroupId.split("-g")[0]
                                );
                                handleGroupChange(room.currentGroupId);
                            }}
                        >
                            {getActivityNameByCode(
                                room.currentGroupId,
                                competition.wcif
                            )}
                        </Button>
                    ))}
            </Box>

            <FormControl width="fit-content">
                <FormLabel>Event</FormLabel>
                <Select
                    placeholder="Select event"
                    _placeholder={{ color: "white" }}
                    value={selectedEvent}
                    onChange={(event) => {
                        setSelectedEvent(event?.target.value);
                        setSelectedRound(event?.target.value + "-r1");
                        setAttendance([]);
                    }}
                >
                    {competition.wcif.events.map((event: Event) => (
                        <option key={event.id} value={event.id}>
                            {events.find((e) => e.id === event.id)?.name}
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
                        onChange={(event) => {
                            setSelectedRound(event?.target.value);
                            setAttendance([]);
                        }}
                    >
                        {competition.wcif.events
                            .find((event: Event) => event.id === selectedEvent)
                            ?.rounds.map((round: Round, i: number) => (
                                <option key={round.id} value={round.id}>
                                    {i + 1}
                                </option>
                            ))}
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
                        onChange={(event) =>
                            handleGroupChange(event?.target.value)
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
            {selectedGroup && (
                <>
                    {absentScramblers.length === 0 &&
                    presentScramblers.length === 0 ? (
                        <Heading size="md">No scramblers in this group</Heading>
                    ) : (
                        <Box gap="5" display="flex" flexDirection="column">
                            <Heading>Scramblers</Heading>
                            {presentScramblers.length > 0 && (
                                <PresentPeopleList
                                    persons={presentScramblers}
                                />
                            )}
                            {absentScramblers.length > 0 && (
                                <AbsentPeopleList
                                    persons={absentScramblers}
                                    handleMarkAsPresent={handleMarkAsPresent}
                                    role="SCRAMBLER"
                                />
                            )}
                        </Box>
                    )}
                    {absentRunners.length === 0 &&
                    presentRunners.length === 0 ? (
                        <Heading size="md">No runners in this group</Heading>
                    ) : (
                        <Box gap="5" display="flex" flexDirection="column">
                            <Heading>Runners</Heading>
                            {presentRunners.length > 0 && (
                                <PresentPeopleList persons={presentRunners} />
                            )}
                            {absentRunners.length > 0 && (
                                <AbsentPeopleList
                                    persons={absentRunners}
                                    handleMarkAsPresent={handleMarkAsPresent}
                                    role="RUNNER"
                                />
                            )}
                        </Box>
                    )}
                    {absentJudges.length === 0 && presentJudges.length === 0 ? (
                        <Heading size="md">No judges in this group</Heading>
                    ) : (
                        <Box gap="5" display="flex" flexDirection="column">
                            <Heading>Judges</Heading>
                            {presentJudges.length > 0 && (
                                <PresentPeopleList persons={presentJudges} />
                            )}
                            {absentJudges.length > 0 && (
                                <AbsentPeopleList
                                    persons={absentJudges}
                                    handleMarkAsPresent={handleMarkAsPresent}
                                    role="JUDGE"
                                />
                            )}
                        </Box>
                    )}
                </>
            )}
        </Box>
    );
};

export default Attendance;
