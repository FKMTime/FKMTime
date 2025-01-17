import { useAtom } from "jotai";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import EventRoundAndGroupSelector from "@/Components/EventRoundAndGroupSelector copy";
import LoadingPage from "@/Components/LoadingPage";
import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import {
    getAttendanceByGroupId,
    markAsAbsent,
    markAsPresent,
} from "@/lib/attendance";
import { getCompetitionInfo } from "@/lib/competition";
import { Room, StaffActivity } from "@/lib/interfaces";
import { getAllRooms } from "@/lib/rooms";
import PageTransition from "@/Pages/PageTransition";
import { socket, SocketContext } from "@/socket";

import AbsentPeopleList from "./Components/AbsentPeopleList";
import PresentPeopleList from "./Components/PresentPeopleList";
import UnorderedPeopleList from "./Components/UnorderedPeopleList";

const Attendance = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const selectedGroup = id ? id : "";
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [attendance, setAttendance] = useState<StaffActivity[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);

    const [selectedEvent, setSelectedEvent] = useState<string>("");
    const [selectedRound, setSelectedRound] = useState<string>("");
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
            });
            fetchAttendanceData(selectedGroup);
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
    };

    const handleMarkAsAbsent = async (staffActivityId: string) => {
        const status = await markAsAbsent(staffActivityId);
        if (status === 201) {
            toast({
                title: "Success",
                description: "Marked as absent",
            });
            fetchAttendanceData(selectedGroup);
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
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

    const [isConnected] = useContext(SocketContext) as [
        number,
        React.Dispatch<React.SetStateAction<number>>,
    ];
    useEffect(() => {
        if (selectedGroup) {
            setSelectedEvent(selectedGroup.split("-")[0]);
            setSelectedRound(selectedGroup.split("-g")[0]);
            fetchAttendanceData(selectedGroup);

            socket.emit("joinAttendance", { groupId: selectedGroup });
            socket.on("newAttendance", () => {
                fetchAttendanceData(selectedGroup);
            });

            return () => {
                socket.emit("leaveAttendance", { groupId: selectedGroup });
            };
        }
    }, [rooms, selectedGroup, isConnected]);

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
        <PageTransition>
            <div className="flex flex-col gap-3">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex justify-between items-center">
                            Attendance
                            <Button
                                onClick={() =>
                                    navigate("/attendance/statistics")
                                }
                            >
                                Statistics
                            </Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <EventRoundAndGroupSelector
                            competition={competition}
                            filters={{
                                eventId: selectedEvent,
                                roundId: selectedRound,
                                groupId: selectedGroup,
                            }}
                            handleEventChange={(eventId) => {
                                setSelectedEvent(eventId);
                                setSelectedRound(eventId + "-r1");
                                handleGroupChange(`${eventId}-r1-g1`);
                            }}
                            handleRoundChange={(roundId) => {
                                setSelectedRound(roundId);
                                handleGroupChange(`${roundId}-g1`);
                            }}
                            handleGroupChange={handleGroupChange}
                        />
                    </CardContent>
                </Card>
                {rooms.filter((r) => r.currentGroupId).length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Current groups</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {rooms
                                    .filter((r) => r.currentGroupId)
                                    .map((room: Room) => (
                                        <Button
                                            key={room.id}
                                            onClick={() => {
                                                setSelectedEvent(
                                                    room.currentGroupId.split(
                                                        "-"
                                                    )[0]
                                                );
                                                setSelectedRound(
                                                    room.currentGroupId.split(
                                                        "-g"
                                                    )[0]
                                                );
                                                handleGroupChange(
                                                    room.currentGroupId
                                                );
                                            }}
                                        >
                                            {activityCodeToName(
                                                room.currentGroupId
                                            )}
                                        </Button>
                                    ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
                {selectedGroup ? (
                    <div className="flex flex-col gap-5 md:grid md:grid-cols-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Competitors</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {noCompetitors ? (
                                    <h2 className="text-lg">
                                        No competitors in this group
                                    </h2>
                                ) : (
                                    <div className="flex flex-col gap-5">
                                        {absentCompetitors.length > 0 && (
                                            <div className="flex flex-col gap-2">
                                                <h2 className="font-bold text-lg">
                                                    Absent
                                                </h2>
                                                <UnorderedPeopleList
                                                    persons={absentCompetitors}
                                                />
                                            </div>
                                        )}
                                        {presentCompetitors.length > 0 && (
                                            <div className="flex flex-col gap-2">
                                                <h2 className="font-bold text-lg">
                                                    Present
                                                </h2>
                                                <UnorderedPeopleList
                                                    persons={presentCompetitors}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Scramblers</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {noScramblers ? (
                                    <h2 className="text-lg">
                                        No scramblers in this group
                                    </h2>
                                ) : (
                                    <div className="flex flex-col gap-5">
                                        {absentScramblers.length > 0 && (
                                            <div className="flex flex-col gap-2">
                                                <h2 className="font-bold text-lg">
                                                    Absent
                                                </h2>
                                                <AbsentPeopleList
                                                    staffActivities={
                                                        absentScramblers
                                                    }
                                                    handleMarkAsPresent={
                                                        handleMarkAsPresent
                                                    }
                                                />
                                            </div>
                                        )}
                                        {presentScramblers.length > 0 && (
                                            <div className="flex flex-col gap-2">
                                                <h2 className="font-bold text-lg">
                                                    Present
                                                </h2>
                                                <PresentPeopleList
                                                    staffActivities={
                                                        presentScramblers
                                                    }
                                                    handleMarkAsAbsent={
                                                        handleMarkAsAbsent
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Runners</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {noRunners ? (
                                    <h2 className="text-lg">
                                        No runners in this group
                                    </h2>
                                ) : (
                                    <div className="flex flex-col gap-5">
                                        {absentRunners.length > 0 && (
                                            <div className="flex flex-col gap-2">
                                                <h2 className="font-bold text-lg">
                                                    Absent
                                                </h2>
                                                <AbsentPeopleList
                                                    staffActivities={
                                                        absentRunners
                                                    }
                                                    handleMarkAsPresent={
                                                        handleMarkAsPresent
                                                    }
                                                />
                                            </div>
                                        )}
                                        {presentRunners.length > 0 && (
                                            <div className="flex flex-col gap-2">
                                                <h2 className="font-bold text-lg">
                                                    Present
                                                </h2>
                                                <PresentPeopleList
                                                    staffActivities={
                                                        presentRunners
                                                    }
                                                    handleMarkAsAbsent={
                                                        handleMarkAsAbsent
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Judges</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {noJudges ? (
                                    <h2 className="text-lg">
                                        No judges in this group
                                    </h2>
                                ) : (
                                    <div className="flex flex-col gap-5">
                                        {absentJudges.length > 0 && (
                                            <div className="flex flex-col gap-2">
                                                <h2 className="font-bold text-lg">
                                                    Absent
                                                </h2>
                                                <AbsentPeopleList
                                                    staffActivities={
                                                        absentJudges
                                                    }
                                                    handleMarkAsPresent={
                                                        handleMarkAsPresent
                                                    }
                                                />
                                            </div>
                                        )}
                                        {presentJudges.length > 0 && (
                                            <div className="flex flex-col gap-2">
                                                <h2 className="font-bold text-lg">
                                                    Present
                                                </h2>
                                                <PresentPeopleList
                                                    staffActivities={
                                                        presentJudges
                                                    }
                                                    handleMarkAsAbsent={
                                                        handleMarkAsAbsent
                                                    }
                                                    showDevice
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                ) : null}
            </div>
        </PageTransition>
    );
};

export default Attendance;
