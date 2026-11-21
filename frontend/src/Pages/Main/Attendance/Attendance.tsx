import { useAtomValue } from "jotai";
import { Footprints, Gavel, Shuffle, Users } from "lucide-react";
import { useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import EmptyState from "@/Components/shared/EmptyState";
import RefreshingRegion from "@/Components/shared/RefreshingRegion";
import RequestError from "@/Components/shared/RequestError";
import ToggleChip from "@/Components/shared/ToggleChip";
import { useAttendanceScope } from "@/hooks/useAttendanceScope";
import { useConfirm } from "@/hooks/useConfirm";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useSocketRoom } from "@/hooks/useSocketRoom";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import {
    getStaffActivitiesByPersonId,
    groupAttendanceQuery,
    groupDay,
    markAsReplaced,
    noShowGroupIds,
    roundStaffingQuery,
    setLeftEarly,
} from "@/lib/attendance";
import { StaffActivity, StaffActivityStatus } from "@/lib/interfaces";
import { toQueryOptions } from "@/lib/queryCache";
import { queryClient } from "@/lib/queryClient";
import { roomsQuery } from "@/lib/rooms";

import AttendanceTabs from "./Components/AttendanceTabs";
import GroupPicker from "./Components/GroupPicker";
import RoleCard from "./Components/RoleCard";

const ROLES = [
    { role: "COMPETITOR", title: "Competitors", icon: Users },
    { role: "SCRAMBLER", title: "Scramblers", icon: Shuffle },
    { role: "RUNNER", title: "Runners", icon: Footprints },
    { role: "JUDGE", title: "Judges", icon: Gavel },
] as const;
const ROLE_KEYS = ROLES.map(({ role }) => role);

/** "Main Hall", "Main Hall and Side Hall" */
const listRoomNames = (rooms: { name: string }[]) => {
    const names = rooms.map((room) => room.name);
    return names.length <= 1
        ? names[0] ?? ""
        : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};

import { useMarkAttendance } from "./useMarkAttendance";
import { useNoShow } from "./useNoShow";
import { useShownRoles } from "./useShownRoles";

const Attendance = () => {
    const { id: selectedGroup = "" } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const confirm = useConfirm();
    const competition = useAtomValue(competitionAtom);
    const roundId = selectedGroup.split("-g")[0];
    const { data: roomsData } = useLiveQuery(roomsQuery);
    // A stage lead takes attendance in their rooms only (SPEC-016)
    const scope = useAttendanceScope();
    const rooms = (roomsData ?? []).filter((room) => scope.hasRoom(room.id));
    const isOutOfScope = !!selectedGroup && !scope.hasGroup(selectedGroup);
    const openGroup = isOutOfScope ? "" : selectedGroup;
    const { data: staffing } = useLiveQuery(roundStaffingQuery(roundId), {
        enabled: !!openGroup,
    });
    const hasAssignedRunners = staffing?.hasAssignedRunners ?? false;
    // The last group's attendance stays while the next group loads
    const attendanceQuery = groupAttendanceQuery(openGroup);
    const {
        data: attendanceData,
        isError,
        isPreviousData,
        refetch,
    } = useLiveQuery(attendanceQuery, {
        keepPreviousData: true,
        enabled: !!openGroup,
    });
    const attendance: StaffActivity[] = attendanceData ?? [];
    const fetchAttendance = () =>
        void queryClient.invalidateQueries({
            queryKey: toQueryOptions(attendanceQuery).queryKey,
        });
    useSocketRoom(openGroup ? "Attendance" : null, {
        params: { groupId: openGroup },
        invalidateOn: {
            newAttendance: toQueryOptions(attendanceQuery).queryKey,
        },
    });

    const selectGroup = useCallback(
        (groupId: string) => navigate(`/attendance/${groupId}`),
        [navigate]
    );

    // Open the only running group straight away
    useEffect(() => {
        if (selectedGroup || !roomsData) return;
        const running = rooms.filter(
            (room) => room.currentGroupIds.length === 1
        );
        if (running.length === 1) selectGroup(running[0].currentGroupIds[0]);
    }, [roomsData, rooms, selectGroup, selectedGroup]);

    const { shown: shownRoles, toggle: toggleRole } = useShownRoles(
        ROLE_KEYS,
        selectedGroup,
        ROLE_KEYS.filter((role) => !attendance.some((a) => a.role === role))
    );

    const {
        change,
        markOne: run,
        markMany,
    } = useMarkAttendance(attendance, fetchAttendance);
    const setNoShowFor = useNoShow(fetchAttendance);

    /**
     * Not coming, or coming after all: a competitor to this group, staff to
     * this group and any later one that day
     */
    const handleSetNoShow = async (
        activity: StaffActivity,
        noShow: boolean
    ) => {
        if (activity.role === "COMPETITOR") {
            setNoShowFor(activity.person, [activity.groupId], noShow, true);
            return;
        }
        if (!competition) return;
        const day = groupDay(competition.wcif, activity.groupId);
        const personActivities: StaffActivity[] =
            await getStaffActivitiesByPersonId(activity.person.id);
        const laterGroupIds = day
            ? noShowGroupIds(competition.wcif, personActivities, day)
            : [];
        setNoShowFor(
            activity.person,
            [...new Set([activity.groupId, ...laterGroupIds])],
            noShow
        );
    };

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

    return (
        <div className="flex flex-col gap-4">
            <AttendanceTabs value="groups" />
            <GroupPicker
                wcif={competition.wcif}
                rooms={rooms}
                value={openGroup}
                onValueChange={selectGroup}
                hasGroup={scope.groupIds ? scope.hasGroup : undefined}
            />

            {isOutOfScope && scope.rooms ? (
                <EmptyState>
                    {`You take attendance for ${listRoomNames(scope.rooms)} only.`}
                </EmptyState>
            ) : selectedGroup ? (
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
                    <div
                        role="group"
                        aria-label="Roles shown"
                        className="flex flex-wrap gap-2"
                    >
                        {ROLES.map(({ role, title, icon: Icon }) => (
                            <ToggleChip
                                key={role}
                                pressed={shownRoles.includes(role)}
                                onPressedChange={() => toggleRole(role)}
                            >
                                <Icon aria-hidden className="size-4" />
                                {title}
                            </ToggleChip>
                        ))}
                    </div>
                    {isError && (
                        <RequestError
                            hasData={!!attendanceData}
                            onRetry={() => void refetch()}
                        />
                    )}
                    <RefreshingRegion
                        isRefreshing={isPreviousData}
                        className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 2xl:grid-cols-4"
                    >
                        {ROLES.filter(({ role }) =>
                            shownRoles.includes(role)
                        ).map(({ role, title, icon }) => (
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
                                wcif={competition.wcif}
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
                                onMarkReplaced={(
                                    id,
                                    wasPresent,
                                    replacedById
                                ) =>
                                    change(
                                        id,
                                        () =>
                                            markAsReplaced(
                                                id,
                                                wasPresent,
                                                replacedById
                                            ),
                                        "marked replaced"
                                    )
                                }
                                onSetLeftEarly={(id, leftEarly) =>
                                    change(
                                        id,
                                        () => setLeftEarly(id, leftEarly),
                                        leftEarly
                                            ? "marked left early"
                                            : "marked as staying to the end"
                                    )
                                }
                                onSetNoShow={handleSetNoShow}
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
