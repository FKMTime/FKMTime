import {
    Box,
    Button,
    Flex,
    FormControl,
    FormLabel,
    Heading,
    useToast,
} from "@chakra-ui/react";
import { Activity, Event, Round } from "@wca/helpers";
import { useAtom } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import io from "socket.io-client";

import Select from "@/Components/Select";
import { getGroupsByRoundId } from "@/logic/activities";
import { competitionAtom } from "@/logic/atoms";
import { getAttendanceByGroupId, markAsPresent } from "@/logic/attendance";
import { getToken } from "@/logic/auth";
import { getCompetitionInfo } from "@/logic/competition";
import { ATTENDANCE_WEBSOCKET_URL, WEBSOCKET_PATH } from "@/logic/request";
import { getAllRooms } from "@/logic/rooms";
import { getAbsentPeople, getActivityNameByCode } from "@/logic/utils";

import LoadingPage from "../../Components/LoadingPage";
import events from "../../logic/events";
import { Attendance as AttendanceType, Room } from "../../logic/interfaces";
import AbsentPeopleList from "./Components/AbsentPeopleList";
import PresentPeopleList from "./Components/PresentPeopleList";

const Attendance = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const toast = useToast();
    const selectedGroup = id ? id : "";
    const [socket] = useState(
        io(ATTENDANCE_WEBSOCKET_URL, {
            transports: ["websocket"],
            path: WEBSOCKET_PATH,
            closeOnBeforeunload: true,
            auth: {
                token: getToken(),
            },
        })
    );
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [attendance, setAttendance] = useState<AttendanceType[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);

    const [selectedEvent, setSelectedEvent] = useState<string>("");
    const [selectedRound, setSelectedRound] = useState<string>("");
    const groups = useMemo(() => {
        if (
            !competition ||
            !selectedRound ||
            !selectedEvent ||
            selectedEvent === ""
        ) {
            return [];
        }
        return getGroupsByRoundId(selectedRound, competition.wcif);
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

    const handleGroupChange = useCallback(
        (groupId: string) => {
            navigate(`/attendance/${groupId}`);
        },
        [navigate]
    );

    const fetchAttendanceData = async (groupId: string) => {
        const data = await getAttendanceByGroupId(groupId);
        setAttendance(data);
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
        getAllRooms().then((data: Room[]) => {
            setRooms(data);
            if (data.filter((r) => r.currentGroupId).length === 1) {
                handleGroupChange(
                    data.filter((r) => r.currentGroupId)[0].currentGroupId
                );
            }
        });
    }, [handleGroupChange]);

    useEffect(() => {
        if (!competition) {
            getCompetitionInfo().then((response) => {
                setCompetition(response.data);
            });
        }
    }, [competition, setCompetition]);

    useEffect(() => {
        if (selectedGroup) {
            setSelectedEvent(selectedGroup.split("-")[0]);
            setSelectedRound(selectedGroup.split("-g")[0]);
            fetchAttendanceData(selectedGroup);
            socket.emit("join", { groupId: selectedGroup });

            socket.on("newAttendance", () => {
                fetchAttendanceData(selectedGroup);
            });

            return () => {
                socket.emit("leave", { groupId: selectedGroup });
            };
        }
    }, [rooms, selectedGroup, socket]);

    if (!competition) {
        return <LoadingPage />;
    }

    const noRunners = absentRunners.length === 0 && presentRunners.length === 0;
    const noScramblers =
        absentScramblers.length === 0 && presentScramblers.length === 0;
    const noJudges = absentJudges.length === 0 && presentJudges.length === 0;

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
                    value={selectedEvent}
                    onChange={(event) => {
                        setSelectedEvent(event?.target.value);
                        setSelectedRound(event?.target.value + "-r1");
                        handleGroupChange(`${event?.target.value}-r1-g1`);
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
                        value={selectedRound}
                        onChange={(event) => {
                            setSelectedRound(event?.target.value);
                            handleGroupChange(`${event?.target.value}-g1`);
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
                <Flex
                    gap={{ base: 3, md: 20 }}
                    flexDirection={{ base: "column", md: "row" }}
                >
                    <Box>
                        {noScramblers ? (
                            <Heading size="md">
                                No scramblers in this group
                            </Heading>
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
                                        handleMarkAsPresent={
                                            handleMarkAsPresent
                                        }
                                        role="SCRAMBLER"
                                    />
                                )}
                            </Box>
                        )}
                    </Box>
                    <Box>
                        {noRunners ? (
                            <Heading size="md">
                                No runners in this group
                            </Heading>
                        ) : (
                            <Box gap="5" display="flex" flexDirection="column">
                                <Heading>Runners</Heading>
                                {presentRunners.length > 0 && (
                                    <PresentPeopleList
                                        persons={presentRunners}
                                    />
                                )}
                                {absentRunners.length > 0 && (
                                    <AbsentPeopleList
                                        persons={absentRunners}
                                        handleMarkAsPresent={
                                            handleMarkAsPresent
                                        }
                                        role="RUNNER"
                                    />
                                )}
                            </Box>
                        )}
                    </Box>
                    <Box>
                        {noJudges ? (
                            <Heading size="md">No judges in this group</Heading>
                        ) : (
                            <Box gap="5" display="flex" flexDirection="column">
                                <Heading>Judges</Heading>
                                {presentJudges.length > 0 && (
                                    <PresentPeopleList
                                        persons={presentJudges}
                                    />
                                )}
                                {absentJudges.length > 0 && (
                                    <AbsentPeopleList
                                        persons={absentJudges}
                                        handleMarkAsPresent={
                                            handleMarkAsPresent
                                        }
                                        role="JUDGE"
                                    />
                                )}
                            </Box>
                        )}
                    </Box>
                </Flex>
            )}
        </Box>
    );
};

export default Attendance;
