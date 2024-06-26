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

import LoadingPage from "@/Components/LoadingPage";
import Select from "@/Components/Select";
import { activityCodeToName, getGroupsByRoundId } from "@/logic/activities";
import { competitionAtom } from "@/logic/atoms";
import {
    getAttendanceByGroupId,
    markAsAbsent,
    markAsPresent,
} from "@/logic/attendance";
import { getToken } from "@/logic/auth";
import { getCompetitionInfo } from "@/logic/competition";
import { getEventName } from "@/logic/events";
import { Room, StaffActivity } from "@/logic/interfaces";
import { ATTENDANCE_WEBSOCKET_URL, WEBSOCKET_PATH } from "@/logic/request";
import { getAllRooms } from "@/logic/rooms";
import PresentPeopleList from "@/Pages/Attendance/Components/PresentPeopleList";

import AbsentPeopleList from "./Components/AbsentPeopleList";
import UnorderedPeopleList from "./Components/UnorderedPeopleList";

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
    const [attendance, setAttendance] = useState<StaffActivity[]>([]);
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
        return attendance.filter((a) => a.role === "SCRAMBLER" && a.isPresent);
    }, [attendance]);
    const presentRunners = useMemo(() => {
        return attendance.filter((a) => a.role === "RUNNER" && a.isPresent);
    }, [attendance]);
    const presentJudges = useMemo(() => {
        return attendance.filter((a) => a.role === "JUDGE" && a.isPresent);
    }, [attendance]);
    const presentCompetitors = useMemo(() => {
        return attendance.filter((a) => a.role === "COMPETITOR" && a.isPresent);
    }, [attendance]);

    const absentScramblers = useMemo(() => {
        return attendance.filter((a) => a.role === "SCRAMBLER" && !a.isPresent);
    }, [attendance]);
    const absentRunners = useMemo(() => {
        return attendance.filter((a) => a.role === "RUNNER" && !a.isPresent);
    }, [attendance]);
    const absentJudges = useMemo(() => {
        return attendance.filter((a) => a.role === "JUDGE" && !a.isPresent);
    }, [attendance]);
    const absentCompetitors = useMemo(() => {
        return attendance.filter(
            (a) => a.role === "COMPETITOR" && !a.isPresent
        );
    }, [attendance]);

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

    const handleMarkAsPresent = async (staffActivityId: string) => {
        const status = await markAsPresent(staffActivityId);
        if (status === 201) {
            toast({
                title: "Success",
                description: "Marked as present",
                status: "success",
            });
            fetchAttendanceData(selectedGroup);
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                status: "error",
            });
        }
    };

    const handleMarkAsAbsent = async (staffActivityId: string) => {
        const status = await markAsAbsent(staffActivityId);
        if (status === 201) {
            toast({
                title: "Success",
                description: "Marked as absent",
                status: "success",
            });
            fetchAttendanceData(selectedGroup);
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                status: "error",
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
    const noCompetitors =
        absentCompetitors.length === 0 && presentCompetitors.length === 0;

    return (
        <Box display="flex" flexDirection="column" gap="5">
            <Heading size="lg">Attendance</Heading>
            <Button
                colorScheme="yellow"
                onClick={() => navigate("/attendance/statistics")}
                width={{ base: "100%", md: "fit-content" }}
            >
                Statistics
            </Button>
            {rooms.filter((r) => r.currentGroupId).length > 0 && (
                <>
                    <Heading size="md">Current groups</Heading>
                    <Box display="flex" gap="2" flexWrap="wrap">
                        {rooms
                            .filter((r) => r.currentGroupId)
                            .map((room: Room) => (
                                <Button
                                    key={room.id}
                                    colorScheme="blue"
                                    width={{ base: "100%", md: "auto" }}
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
                                    {activityCodeToName(room.currentGroupId)}
                                </Button>
                            ))}
                    </Box>
                </>
            )}
            <Flex flexDirection={{ base: "column", md: "row" }} gap="5">
                <FormControl width="fit-content">
                    <FormLabel>Event</FormLabel>
                    <Select
                        value={selectedEvent}
                        placeholder="Select event"
                        onChange={(event) => {
                            setSelectedEvent(event?.target.value);
                            setSelectedRound(event?.target.value + "-r1");
                            handleGroupChange(`${event?.target.value}-r1-g1`);
                        }}
                    >
                        {competition.wcif.events.map((event: Event) => (
                            <option key={event.id} value={event.id}>
                                {getEventName(event.id)}
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
                                .find(
                                    (event: Event) => event.id === selectedEvent
                                )
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
            </Flex>
            {selectedGroup && (
                <Flex
                    gap={{ base: 3, md: 20 }}
                    flexDirection={{ base: "column", md: "row" }}
                >
                    <Box>
                        {noCompetitors ? (
                            <Heading size="md">
                                No competitors in this group
                            </Heading>
                        ) : (
                            <Box gap="5" display="flex" flexDirection="column">
                                <Heading>Competitors</Heading>
                                {presentCompetitors.length > 0 && (
                                    <UnorderedPeopleList
                                        persons={presentCompetitors}
                                    />
                                )}
                                {absentCompetitors.length > 0 && (
                                    <UnorderedPeopleList
                                        persons={absentCompetitors}
                                        heading="Absent"
                                    />
                                )}
                            </Box>
                        )}
                    </Box>
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
                                        staffActivities={presentScramblers}
                                        handleMarkAsAbsent={handleMarkAsAbsent}
                                    />
                                )}
                                {absentScramblers.length > 0 && (
                                    <AbsentPeopleList
                                        staffActivities={absentScramblers}
                                        handleMarkAsPresent={
                                            handleMarkAsPresent
                                        }
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
                                        staffActivities={presentRunners}
                                        handleMarkAsAbsent={handleMarkAsAbsent}
                                    />
                                )}
                                {absentRunners.length > 0 && (
                                    <AbsentPeopleList
                                        staffActivities={absentRunners}
                                        handleMarkAsPresent={
                                            handleMarkAsPresent
                                        }
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
                                        staffActivities={presentJudges}
                                        handleMarkAsAbsent={handleMarkAsAbsent}
                                        showDevice
                                    />
                                )}
                                {absentJudges.length > 0 && (
                                    <AbsentPeopleList
                                        staffActivities={absentJudges}
                                        handleMarkAsPresent={
                                            handleMarkAsPresent
                                        }
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
