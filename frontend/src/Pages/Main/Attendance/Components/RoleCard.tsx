import {
    ArrowLeftRight,
    Check,
    CheckCheck,
    ClockAlert,
    LucideIcon,
    MessageSquareText,
    Replace,
    ShieldAlert,
    UserPlus,
    X,
} from "lucide-react";
import { ReactNode, useState } from "react";

import RowActions, { RowAction } from "@/Components/shared/RowActions";
import { StatusBadge } from "@/Components/shared/StatusBadge";
import { Button } from "@/Components/ui/button";
import { StaffActivity, StaffActivityStatus } from "@/lib/interfaces";
import { isDelegate } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import IssueWarningModal from "@/Pages/Main/Persons/Components/IssueWarningModal";

import ChangeCompetingGroupModal from "./AbsentCompetitors/ChangeCompetingGroupModal";
import AddNotAssignedPersonModal from "./AddNotAssignedPersonModal";
import DetailsModal from "./DetailsModal";

export interface AttendanceHandlers {
    onMarkPresent: (id: string) => void;
    onMarkAbsent: (id: string) => void;
    onMarkAllPresent: (ids: string[]) => void;
    onMarkLate: (id: string) => void;
    onMarkPresentButReplaced: (id: string) => void;
}

interface RoleCardProps extends AttendanceHandlers {
    role: "COMPETITOR" | "SCRAMBLER" | "RUNNER" | "JUDGE";
    title: string;
    icon: LucideIcon;
    attendance: StaffActivity[];
    groupId: string;
    /** Judges only: stations once runners are assigned for the round */
    showStations?: boolean;
    /** Competitors only: e.g. the ranking from the previous round */
    describeCompetitor?: (activity: StaffActivity) => ReactNode;
    onChanged: () => void;
}

const PRESENT_STATUSES = [
    StaffActivityStatus.PRESENT,
    StaffActivityStatus.REPLACED,
    StaffActivityStatus.LATE,
];

type Dialog =
    | { type: "comment" | "warning" | "group"; activity: StaffActivity }
    | { type: "add" };

/** One role in a group: who is absent, who is present, and what to do about it */
const RoleCard = ({
    role,
    title,
    icon: Icon,
    attendance,
    groupId,
    showStations,
    describeCompetitor,
    onChanged,
    onMarkPresent,
    onMarkAbsent,
    onMarkAllPresent,
    onMarkLate,
    onMarkPresentButReplaced,
}: RoleCardProps) => {
    const [dialog, setDialog] = useState<Dialog | null>(null);
    const isCompetitor = role === "COMPETITOR";
    const people = attendance.filter((a) => a.role === role);
    const present = people.filter((a) => PRESENT_STATUSES.includes(a.status));
    const absent = people.filter(
        (a) => a.status === StaffActivityStatus.ABSENT
    );

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
                        label: "Present but replaced",
                        icon: Replace,
                        onSelect: () => onMarkPresentButReplaced(activity.id),
                    },
                    ...commentAndWarning(activity),
                ]}
            />
        );

    const presentTag = (activity: StaffActivity) => {
        if (activity.status === StaffActivityStatus.LATE)
            return <StatusBadge tone="warning">Late</StatusBadge>;
        if (activity.status === StaffActivityStatus.REPLACED)
            return <StatusBadge tone="neutral">Replaced</StatusBadge>;
        if (!activity.isAssigned)
            return <StatusBadge tone="primary">Unassigned</StatusBadge>;
        return null;
    };

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
                                        {isCompetitor &&
                                            describeCompetitor?.(activity)}
                                    </span>
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
                                        {showStations && activity.device && (
                                            <span className="text-muted-foreground">
                                                {" "}
                                                · Station {activity.device.name}
                                            </span>
                                        )}
                                    </span>
                                    {presentTag(activity)}
                                    {!isCompetitor && (
                                        <RowActions
                                            subject={activity.person.name}
                                            items={[
                                                ...commentAndWarning(activity),
                                                {
                                                    label: "Mark absent",
                                                    icon: X,
                                                    destructive: true,
                                                    onSelect: () =>
                                                        onMarkAbsent(
                                                            activity.id
                                                        ),
                                                },
                                            ]}
                                        />
                                    )}
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
            {dialog?.type === "group" && (
                <ChangeCompetingGroupModal
                    isOpen
                    onClose={closeDialog}
                    activity={dialog.activity}
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
