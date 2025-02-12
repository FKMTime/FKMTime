import { useAtom } from "jotai";
import { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import { useToast } from "@/hooks/useToast";
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

import AttendanceHeaderCard from "./Components/AttendanceHeaderCard";
import CompetitorsCard from "./Components/CompetitorsCard";
import CurrentGroupsCard from "./Components/CurrentGroupsCard";
import JudgesCard from "./Components/JudgesCard";
import RunnersCard from "./Components/RunnersCard";
import ScramblersCard from "./Components/ScramblersCard";

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
                variant: "success",
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
            const roomsWithOneGroup = data.filter(
                (r) => r.currentGroupIds.length === 1
            );
            if (roomsWithOneGroup.length === 1) {
                handleGroupChange(roomsWithOneGroup[0].currentGroupIds[0]);
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

    return (
        <PageTransition>
            <div className="flex flex-col gap-4">
                <AttendanceHeaderCard
                    competition={competition}
                    selectedEvent={selectedEvent}
                    selectedRound={selectedRound}
                    selectedGroup={selectedGroup}
                    setSelectedEvent={setSelectedEvent}
                    setSelectedRound={setSelectedRound}
                    handleGroupChange={handleGroupChange}
                />
                {rooms.filter((r) => r.currentGroupIds.length > 0).length >
                    0 && (
                    <CurrentGroupsCard
                        rooms={rooms}
                        setSelectedEvent={setSelectedEvent}
                        setSelectedRound={setSelectedRound}
                        handleGroupChange={handleGroupChange}
                    />
                )}
                {selectedGroup ? (
                    <PageTransition>
                        <div className="flex flex-col gap-5 md:grid md:grid-cols-4">
                            <CompetitorsCard attendance={attendance} />
                            <ScramblersCard
                                attendance={attendance}
                                handleMarkAsPresent={handleMarkAsPresent}
                                handleMarkAsAbsent={handleMarkAsAbsent}
                            />
                            <RunnersCard
                                attendance={attendance}
                                handleMarkAsPresent={handleMarkAsPresent}
                                handleMarkAsAbsent={handleMarkAsAbsent}
                            />
                            <JudgesCard
                                attendance={attendance}
                                handleMarkAsPresent={handleMarkAsPresent}
                                handleMarkAsAbsent={handleMarkAsAbsent}
                            />
                        </div>
                    </PageTransition>
                ) : null}
            </div>
        </PageTransition>
    );
};

export default Attendance;
