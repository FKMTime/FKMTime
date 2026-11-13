import { useAtomValue } from "jotai";
import {
    ArrowLeftRight,
    CalendarCheck,
    CalendarX,
    Check,
    CheckCheck,
    ClockAlert,
    DoorOpen,
    LucideIcon,
    MessageSquareText,
    Replace,
    ShieldAlert,
    UserMinus,
    UserPlus,
    X,
} from "lucide-react";
import { ReactNode, useState } from "react";
import { Competition as WCIF } from "wcif-helpers";

import WithdrawFromRoundModal from "@/Components/IntegratedLive/WithdrawFromRoundModal";
import RowActions, { RowAction } from "@/Components/shared/RowActions";
import { StatusBadge } from "@/Components/shared/StatusBadge";
import { Button } from "@/Components/ui/button";
import { competitionAtom } from "@/lib/atoms";
import { StaffActivity, StaffActivityStatus } from "@/lib/interfaces";
import { isDelegate, isOrganizerOrDelegate } from "@/lib/permissions";
import { getRankingFromPreviousRound } from "@/lib/results";
import { cn } from "@/lib/utils";
import IssueWarningModal from "@/Pages/Main/Persons/Components/IssueWarningModal";

import ChangeCompetingGroupModal from "./AbsentCompetitors/ChangeCompetingGroupModal";
import AddNotAssignedPersonModal from "./AddNotAssignedPersonModal";
import DetailsModal from "./DetailsModal";
import ReplacedModal from "./ReplacedModal";

export interface AttendanceHandlers {
    onMarkPresent: (id: string) => void;
    onMarkAbsent: (id: string) => void;
    onMarkAllPresent: (ids: string[]) => void;
    onMarkLate: (id: string) => void;
    onMarkReplaced: (
        id: string,
        wasPresent: boolean,
        replacedById?: string
    ) => void;
    onSetLeftEarly: (id: string, leftEarly: boolean) => void;
    /** Not coming for the rest of the day, or coming after all */
    onSetNoShow: (activity: StaffActivity, noShow: boolean) => void;
}

interface RoleCardProps extends AttendanceHandlers {
    role: "COMPETITOR" | "SCRAMBLER" | "RUNNER" | "JUDGE";
    title: string;
    icon: LucideIcon;
    attendance: StaffActivity[];
    groupId: string;
    /** Judges only: stations once runners are assigned for the round */
    showStations?: boolean;
    /** For competitors' rankings in the previous round */
    wcif?: WCIF;
    onChanged: () => void;
}

const PRESENT_STATUSES = [
    StaffActivityStatus.PRESENT,
    StaffActivityStatus.REPLACED,
    StaffActivityStatus.LATE,
];

type Dialog =
    | {
          type: "comment" | "warning" | "group" | "replaced" | "withdraw";
          activity: StaffActivity;
      }
    | { type: "add" };

const DID_THE_JOB = [StaffActivityStatus.PRESENT, StaffActivityStatus.LATE];

/** One role in a group: who is absent, who is present, and what to do about it */
const RoleCard = ({
    role,
    title,
    icon: Icon,
    attendance,
    groupId,
    showStations,
    wcif,
    onChanged,
    onMarkPresent,
    onMarkAbsent,
    onMarkAllPresent,
    onMarkLate,
    onMarkReplaced,
    onSetLeftEarly,
    onSetNoShow,
}: RoleCardProps) => {
    const [dialog, setDialog] = useState<Dialog | null>(null);
    const isCompetitor = role === "COMPETITOR";
    const people = attendance.filter((a) => a.role === role);
    const present = people.filter((a) => PRESENT_STATUSES.includes(a.status));
    // People still expected first, those not coming today last
    const absent = people
        .filter((a) => a.status === StaffActivityStatus.ABSENT)
        .sort((a, b) => Number(a.noShow) - Number(b.noShow));

    const roundId = groupId.split("-g")[0];
    const isLaterRound = Number(roundId.split("-r")[1]) > 1;
    const competition = useAtomValue(competitionAtom);
    // Withdrawing from a later round, with the WCA's next in line (9p3)
    const canWithdraw =
        isCompetitor &&
        isLaterRound &&
        isOrganizerOrDelegate() &&
        competition?.officialResultsDestination === "WCA_INTEGRATED_LIVE" &&
        competition.integratedLiveConnection === "CONNECTED";
    const previousRanking = (activity: StaffActivity) => {
        if (!isCompetitor || !isLaterRound || !activity.person.registrantId)
            return null;
        const ranking = getRankingFromPreviousRound(
            roundId,
            activity.person.registrantId,
            wcif
        );
        return (
            ranking !== null && (
                <span
                    className="text-muted-foreground"
                    title="Place in the previous round"
                >
                    {` (${ranking})`}
                </span>
            )
        );
    };

    /** Who this person is covering for in this role */
    const coveringFor = (activity: StaffActivity) =>
        people
            .filter((other) => other.replacedById === activity.person.id)
            .map((other) => other.person.name);

    const closeDialog = () => {
        setDialog(null);
        onChanged();
    };

    const commentAndWarning = (activity: StaffActivity): RowAction[] => [
        {
            label: "Comment",
            icon: MessageSquareText,
            onSelect: () => setDialog({ type: "comment", activity }),
        },
        {
            label: "Issue warning",
            icon: ShieldAlert,
            hidden: !isDelegate(),
            onSelect: () => setDialog({ type: "warning", activity }),
        },
    ];

    const absentActions = (activity: StaffActivity) =>
        isCompetitor ? (
            <RowActions
                subject={activity.person.name}
                primary={{
                    label: "Change group",
                    icon: ArrowLeftRight,
                    onSelect: () => setDialog({ type: "group", activity }),
                }}
                items={[
                    {
                        label: "Remove from round",
                        icon: UserMinus,
                        hidden: !canWithdraw,
                        onSelect: () =>
                            setDialog({ type: "withdraw", activity }),
                    },
                ]}
            />
        ) : (
            <RowActions
                subject={activity.person.name}
                primary={{
                    label: "Mark present",
                    icon: Check,
                    onSelect: () => onMarkPresent(activity.id),
                }}
                items={[
                    {
                        label: "Mark late",
                        icon: ClockAlert,
                        onSelect: () => onMarkLate(activity.id),
                    },
                    {
                        label: "Replaced…",
                        icon: Replace,
                        onSelect: () =>
                            setDialog({ type: "replaced", activity }),
                    },
                    activity.noShow
                        ? {
                              label: "Coming after all",
                              icon: CalendarCheck,
                              onSelect: () => onSetNoShow(activity, false),
                          }
                        : {
                              label: "Not coming today",
                              icon: CalendarX,
                              onSelect: () => onSetNoShow(activity, true),
                          },
                    ...commentAndWarning(activity),
                ]}
            />
        );

    const absentTags = (activity: StaffActivity) => (
        <>
            {activity.noShow && (
                <StatusBadge tone="destructive">Not coming</StatusBadge>
            )}
            {activity.replacedBy && (
                <StatusBadge tone="neutral">
                    Covered by {activity.replacedBy.name}
                </StatusBadge>
            )}
        </>
    );

    const presentTags = (activity: StaffActivity) => {
        const covering = coveringFor(activity);
        return (
            <>
                {activity.status === StaffActivityStatus.LATE && (
                    <StatusBadge tone="warning">Late</StatusBadge>
                )}
                {activity.leftEarly && (
                    <StatusBadge tone="warning">Left early</StatusBadge>
                )}
                {activity.status === StaffActivityStatus.REPLACED && (
                    <StatusBadge tone="neutral">
                        {activity.replacedBy
                            ? `Replaced by ${activity.replacedBy.name}`
                            : "Replaced"}
                    </StatusBadge>
                )}
                {covering.length > 0 && (
                    <StatusBadge tone="primary">
                        Covering for {covering.join(", ")}
                    </StatusBadge>
                )}
                {!activity.isAssigned && covering.length === 0 && (
                    <StatusBadge tone="primary">Unassigned</StatusBadge>
                )}
            </>
        );
    };

    const presentActions = (activity: StaffActivity) => (
        <RowActions
            subject={activity.person.name}
            items={[
                {
                    label: activity.leftEarly
                        ? "Didn't leave early"
                        : "Left early",
                    icon: DoorOpen,
                    hidden: !DID_THE_JOB.includes(activity.status),
                    onSelect: () =>
                        onSetLeftEarly(activity.id, !activity.leftEarly),
                },
                ...commentAndWarning(activity),
                {
                    label: "Mark absent",
                    icon: X,
                    destructive: true,
                    onSelect: () => onMarkAbsent(activity.id),
                },
            ]}
        />
    );

    return (
        <section
            aria-label={title}
            className="flex flex-col rounded-mobile-card border bg-card md:rounded-2xl"
        >
            <header className="flex items-center gap-2.5 border-b py-2.5 pl-4 pr-2">
                <Icon className="size-5 text-muted-foreground" />
                <h3 className="flex-1 font-semibold">{title}</h3>
                <span className="text-sm text-muted-foreground">
                    <b className="font-semibold text-foreground">
                        {present.length}
                    </b>
                    /{people.length}
                </span>
                {!isCompetitor && (
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Add a ${title.toLowerCase().replace(/s$/, "")} who is not assigned`}
                        onClick={() => setDialog({ type: "add" })}
                    >
                        <UserPlus />
                    </Button>
                )}
            </header>

            {people.length === 0 ? (
                <p className="px-4 py-5 text-sm text-muted-foreground">
                    Nobody assigned
                </p>
            ) : (
                <div className="flex flex-col py-1">
                    {absent.length > 0 && (
                        <PeopleSection
                            title="Absent"
                            tone="destructive"
                            action={
                                !isCompetitor &&
                                absent.length > 1 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-xs md:h-7"
                                        onClick={() =>
                                            onMarkAllPresent(
                                                absent.map((a) => a.id)
                                            )
                                        }
                                    >
                                        <CheckCheck />
                                        Mark all present
                                    </Button>
                                )
                            }
                        >
                            {absent.map((activity) => (
                                <li
                                    key={activity.id}
                                    className="flex min-h-11 items-center gap-2 py-1 pl-4 pr-2"
                                >
                                    <span className="min-w-0 flex-1 truncate text-sm">
                                        {activity.person.name}
                                        {previousRanking(activity)}
                                    </span>
                                    {absentTags(activity)}
                                    {absentActions(activity)}
                                </li>
                            ))}
                        </PeopleSection>
                    )}
                    {present.length > 0 && (
                        <PeopleSection title="Present" tone="success">
                            {present.map((activity) => (
                                <li
                                    key={activity.id}
                                    className="flex min-h-11 items-center gap-2 py-1 pl-4 pr-2"
                                >
                                    <span className="min-w-0 flex-1 truncate text-sm">
                                        {activity.person.name}
                                        {previousRanking(activity)}
                                        {showStations && activity.device && (
                                            <span className="text-muted-foreground">
                                                {" "}
                                                · Station {activity.device.name}
                                            </span>
                                        )}
                                    </span>
                                    {presentTags(activity)}
                                    {!isCompetitor && presentActions(activity)}
                                </li>
                            ))}
                        </PeopleSection>
                    )}
                </div>
            )}

            {dialog?.type === "add" && (
                <AddNotAssignedPersonModal
                    isOpen
                    onClose={closeDialog}
                    role={role}
                    groupId={groupId}
                />
            )}
            {dialog?.type === "comment" && (
                <DetailsModal
                    isOpen
                    onClose={closeDialog}
                    staffActivity={dialog.activity}
                />
            )}
            {dialog?.type === "warning" && (
                <IssueWarningModal
                    isOpen
                    onClose={closeDialog}
                    person={dialog.activity.person}
                />
            )}
            {dialog?.type === "replaced" && (
                <ReplacedModal
                    isOpen
                    onClose={() => setDialog(null)}
                    activity={dialog.activity}
                    onConfirm={(wasPresent, replacedById) =>
                        onMarkReplaced(
                            dialog.activity.id,
                            wasPresent,
                            replacedById
                        )
                    }
                />
            )}
            {dialog?.type === "group" && (
                <ChangeCompetingGroupModal
                    isOpen
                    onClose={closeDialog}
                    activity={dialog.activity}
                />
            )}
            {dialog?.type === "withdraw" && (
                <WithdrawFromRoundModal
                    isOpen
                    onClose={closeDialog}
                    roundId={roundId}
                    personId={dialog.activity.person.id}
                />
            )}
        </section>
    );
};

interface PeopleSectionProps {
    title: string;
    tone: "destructive" | "success";
    action?: ReactNode;
    children: ReactNode;
}

const PeopleSection = ({
    title,
    tone,
    action,
    children,
}: PeopleSectionProps) => (
    <div className="flex flex-col">
        <div className="flex items-center justify-between gap-2 pr-2">
            <p
                className={cn(
                    "px-4 pb-0.5 pt-2.5 text-2xs font-bold uppercase",
                    tone === "destructive" ? "text-destructive" : "text-success"
                )}
            >
                {title}
            </p>
            {action}
        </div>
        <ul>{children}</ul>
    </div>
);

export default RoleCard;
