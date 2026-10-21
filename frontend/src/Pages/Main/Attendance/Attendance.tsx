import { useAtomValue } from "jotai";
import { Footprints, Gavel, Shuffle, Users } from "lucide-react";
import { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import EmptyState from "@/Components/shared/EmptyState";
import RefreshingRegion from "@/Components/shared/RefreshingRegion";
import { useConfirm } from "@/hooks/useConfirm";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import { getAttendanceByGroupId, getRoundStaffing } from "@/lib/attendance";
import { Room, StaffActivity, StaffActivityStatus } from "@/lib/interfaces";
import { getRankingFromPreviousRound } from "@/lib/results";
import { getAllRooms } from "@/lib/rooms";
import { socket, SocketContext } from "@/socket";

import AttendanceTabs from "./Components/AttendanceTabs";
import GroupPicker from "./Components/GroupPicker";
import RoleCard from "./Components/RoleCard";

const ROLES = [
    { role: "COMPETITOR", title: "Competitors", icon: Users },
    { role: "SCRAMBLER", title: "Scramblers", icon: Shuffle },
    { role: "RUNNER", title: "Runners", icon: Footprints },
    { role: "JUDGE", title: "Judges", icon: Gavel },
] as const;

import { useMarkAttendance } from "./useMarkAttendance";

const Attendance = () => {
    const { id: selectedGroup = "" } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const confirm = useConfirm();
    const competition = useAtomValue(competitionAtom);
    const [isConnected] = useContext(SocketContext) as [
        number,
        React.Dispatch<React.SetStateAction<number>>,
    ];
    const [rooms, setRooms] = useState<Room[]>([]);
    const [attendance, setAttendance] = useState<StaffActivity[]>([]);
    const [hasAssignedRunners, setHasAssignedRunners] = useState(false);
    const roundId = selectedGroup.split("-g")[0];

    const selectGroup = useCallback(
        (groupId: string) => navigate(`/attendance/${groupId}`),
        [navigate]
    );

    // The group the shown attendance belongs to; differs while the next loads
    const [attendanceGroupId, setAttendanceGroupId] = useState<string>();
    const fetchAttendance = useCallback(async () => {
        if (!selectedGroup) return;
        setAttendance(await getAttendanceByGroupId(selectedGroup));
        setAttendanceGroupId(selectedGroup);
    }, [selectedGroup]);

    useEffect(() => {
        getAllRooms().then((data: Room[]) => {
            setRooms(data);
            // Open the only running group straight away
            const running = data.filter((r) => r.currentGroupIds.length === 1);
            if (!selectedGroup && running.length === 1)
                selectGroup(running[0].currentGroupIds[0]);
        });
    }, [selectGroup, selectedGroup]);

    useEffect(() => {
        let isCancelled = false;
        setHasAssignedRunners(false);
        if (roundId)
            getRoundStaffing(roundId).then((data) => {
                if (!isCancelled)
                    setHasAssignedRunners(data.hasAssignedRunners);
            });
        return () => {
            isCancelled = true;
        };
    }, [roundId, isConnected]);

    useEffect(() => {
        if (!selectedGroup) return;
        fetchAttendance();
        socket.emit("joinAttendance", { groupId: selectedGroup });
        socket.on("newAttendance", fetchAttendance);
        return () => {
            socket.off("newAttendance", fetchAttendance);
            socket.emit("leaveAttendance", { groupId: selectedGroup });
        };
    }, [selectedGroup, fetchAttendance, isConnected]);

    const { markOne: run, markMany } = useMarkAttendance(
        attendance,
        fetchAttendance
    );

    const handleMarkAbsent = async (id: string) => {
        const activity = attendance.find((a) => a.id === id);
        if (activity && !activity.isAssigned) {
            const confirmed = await confirm({
                title: `Mark ${activity.person.name} as absent?`,
                description:
                    "This person is not assigned to this group, so marking them absent removes them from this group's attendance list.",
                confirmLabel: "Mark absent",
            })
                .then(() => true)
                .catch(() => false);
            if (!confirmed) return;
        }
        // Removing an unassigned person can't be put back
        run(StaffActivityStatus.ABSENT, id, "absent", {
            canUndo: !!activity?.isAssigned,
        });
    };

    if (!competition) return <LoadingPage />;

    const staff = attendance.filter((a) => a.role !== "COMPETITOR");
    const presentCount = attendance.filter(
        (a) => a.status !== StaffActivityStatus.ABSENT
    ).length;
    const isLaterRound = Number(roundId.split("-r")[1]) > 1;

    return (
        <div className="flex flex-col gap-4">
            <AttendanceTabs value="groups" />
            <GroupPicker
                wcif={competition.wcif}
                rooms={rooms}
                value={selectedGroup}
                onValueChange={selectGroup}
            />

            {selectedGroup ? (
                <>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <h2 className="text-lg font-bold">
                            {activityCodeToName(selectedGroup)
                                .split(", ")
                                .join(" · ")}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            {presentCount} present ·{" "}
                            {attendance.length - presentCount} absent
                            {staff.length === 0 &&
                                attendance.length > 0 &&
                                " · no staff assigned"}
                        </p>
                    </div>
                    <RefreshingRegion
                        isRefreshing={attendanceGroupId !== selectedGroup}
                        className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 2xl:grid-cols-4"
                    >
                        {ROLES.map(({ role, title, icon }) => (
                            <RoleCard
                                key={role}
                                role={role}
                                title={title}
                                icon={icon}
                                attendance={attendance}
                                groupId={selectedGroup}
                                showStations={
                                    role === "JUDGE" && hasAssignedRunners
                                }
                                describeCompetitor={
                                    isLaterRound
                                        ? (activity) =>
                                              ` (${getRankingFromPreviousRound(roundId, activity.person.registrantId || 0, competition.wcif)})`
                                        : undefined
                                }
                                onChanged={fetchAttendance}
                                onMarkPresent={(id) =>
                                    run(
                                        StaffActivityStatus.PRESENT,
                                        id,
                                        "present"
                                    )
                                }
                                onMarkAbsent={handleMarkAbsent}
                                onMarkAllPresent={(ids) =>
                                    markMany(
                                        StaffActivityStatus.PRESENT,
                                        ids,
                                        "present"
                                    )
                                }
                                onMarkLate={(id) =>
                                    run(StaffActivityStatus.LATE, id, "late")
                                }
                                onMarkPresentButReplaced={(id) =>
                                    run(
                                        StaffActivityStatus.REPLACED,
                                        id,
                                        "present but replaced"
                                    )
                                }
                            />
                        ))}
                    </RefreshingRegion>
                </>
            ) : (
                <EmptyState>Pick a group to take attendance.</EmptyState>
            )}
        </div>
    );
};

export default Attendance;
