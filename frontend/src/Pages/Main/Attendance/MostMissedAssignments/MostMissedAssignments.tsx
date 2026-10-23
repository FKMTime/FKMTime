import { ChevronDown, FileText, Flag, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";

import EmptyState from "@/Components/shared/EmptyState";
import RowActions from "@/Components/shared/RowActions";
import SectionLoading from "@/Components/shared/SectionLoading";
import SegmentedControl from "@/Components/shared/SegmentedControl";
import { StatusTone } from "@/Components/shared/status";
import { StatusBadge } from "@/Components/shared/StatusBadge";
import { activityCodeToName, prettyActivityName } from "@/lib/activities";
import { getMostMissedAssignments } from "@/lib/attendance";
import { MissedAssignments, Person, StaffActivity } from "@/lib/interfaces";
import { isDelegate } from "@/lib/permissions";
import { cn, getInitials } from "@/lib/utils";
import DisplayGroupsModal from "@/Pages/Main/Persons/Components/DisplayGroupsModal";
import DisplayWarningsModal from "@/Pages/Main/Persons/Components/DisplayWarningsModal";
import IssueWarningModal from "@/Pages/Main/Persons/Components/IssueWarningModal";

import AttendanceTabs from "../Components/AttendanceTabs";

type Filter = "all" | "missed" | "late" | "replaced";

const KINDS: {
    key: Exclude<Filter, "all">;
    label: string;
    tone: StatusTone;
    get: (item: MissedAssignments) => StaffActivity[];
}[] = [
    {
        key: "missed",
        label: "missed",
        tone: "destructive",
        get: (item) => item.missedAssignments,
    },
    {
        key: "late",
        label: "late",
        tone: "warning",
        get: (item) => item.lateAssignments,
    },
    {
        key: "replaced",
        label: "replaced",
        tone: "neutral",
        get: (item) => item.presentButReplacedAssignments,
    },
];

type Dialog = { type: "groups" | "warnings" | "warn"; person: Person };

const describe = (activity: StaffActivity) =>
    `${activityCodeToName(activity.groupId, true, true, true)} · ${prettyActivityName(activity.role)}`;

const MostMissedAssignments = () => {
    const [assignments, setAssignments] = useState<MissedAssignments[] | null>(
        null
    );
    const [filter, setFilter] = useState<Filter>("all");
    const [expanded, setExpanded] = useState<string[]>([]);
    const [dialog, setDialog] = useState<Dialog | null>(null);

    useEffect(() => {
        getMostMissedAssignments().then(setAssignments);
    }, []);

    // The tabs stay put while the list loads
    if (!assignments)
        return (
            <div className="flex flex-col gap-4">
                <AttendanceTabs value="missed" />
                <SectionLoading label="Loading missed assignments" />
            </div>
        );

    const matches = (item: MissedAssignments, key: Filter) =>
        key === "all" ||
        KINDS.find((kind) => kind.key === key)!.get(item).length > 0;
    const visible = assignments.filter((item) => matches(item, filter));
    const toggle = (id: string) =>
        setExpanded((current) =>
            current.includes(id)
                ? current.filter((x) => x !== id)
                : [...current, id]
        );

    return (
        <div className="flex flex-col gap-4">
            <AttendanceTabs value="missed" />
            <SegmentedControl
                label="Show"
                value={filter}
                onValueChange={setFilter}
                options={(
                    ["all", "missed", "late", "replaced"] as Filter[]
                ).map((key) => ({
                    value: key,
                    label: (
                        <>
                            {key === "all"
                                ? "All"
                                : key[0].toUpperCase() + key.slice(1)}
                            <span className="text-xs text-faint">
                                {
                                    assignments.filter((item) =>
                                        matches(item, key)
                                    ).length
                                }
                            </span>
                        </>
                    ),
                }))}
            />

            {visible.length === 0 ? (
                <EmptyState>No missed assignments.</EmptyState>
            ) : (
                <ol className="flex flex-col divide-y overflow-hidden rounded-mobile-card border bg-card md:rounded-2xl">
                    {visible.map((item, index) => {
                        const isOpen = expanded.includes(item.person.id);
                        const sections = [
                            ...KINDS.map((kind) => ({
                                title:
                                    kind.key[0].toUpperCase() +
                                    kind.key.slice(1),
                                tone: kind.tone,
                                items: kind.get(item).map(describe),
                            })),
                            {
                                title: "Comments",
                                tone: "neutral" as StatusTone,
                                items: item.comments.map(
                                    (activity) =>
                                        `${describe(activity)}: ${activity.comment || "No comment"}`
                                ),
                            },
                        ].filter((section) => section.items.length > 0);
                        return (
                            <li key={item.person.id}>
                                <div className="flex items-center gap-3 py-2.5 pl-4 pr-2 md:pl-5">
                                    <span className="w-6 text-sm text-faint">
                                        {index + 1}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => toggle(item.person.id)}
                                        aria-expanded={isOpen}
                                        className="flex min-h-11 min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-left"
                                    >
                                        <span
                                            aria-hidden
                                            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-muted-foreground"
                                        >
                                            {getInitials(item.person.name)}
                                        </span>
                                        <span className="font-semibold">
                                            {item.person.name}
                                            <span className="font-normal text-faint">
                                                {" "}
                                                {item.person.registrantId}
                                            </span>
                                        </span>
                                        <span className="flex flex-wrap gap-1.5">
                                            {KINDS.filter(
                                                (kind) => kind.get(item).length
                                            ).map((kind) => (
                                                <StatusBadge
                                                    key={kind.key}
                                                    tone={kind.tone}
                                                >
                                                    {kind.get(item).length}{" "}
                                                    {kind.label}
                                                </StatusBadge>
                                            ))}
                                        </span>
                                        <ChevronDown
                                            className={cn(
                                                "ml-auto size-5 text-faint transition-transform",
                                                isOpen && "rotate-180"
                                            )}
                                        />
                                    </button>
                                    <RowActions
                                        subject={item.person.name}
                                        primary={{
                                            label: "Groups",
                                            icon: FileText,
                                            onSelect: () =>
                                                setDialog({
                                                    type: "groups",
                                                    person: item.person,
                                                }),
                                        }}
                                        items={[
                                            {
                                                label: "Warnings",
                                                icon: Flag,
                                                hidden: !isDelegate(),
                                                onSelect: () =>
                                                    setDialog({
                                                        type: "warnings",
                                                        person: item.person,
                                                    }),
                                            },
                                            {
                                                label: "Issue warning",
                                                icon: ShieldAlert,
                                                hidden: !isDelegate(),
                                                onSelect: () =>
                                                    setDialog({
                                                        type: "warn",
                                                        person: item.person,
                                                    }),
                                            },
                                        ]}
                                    />
                                </div>
                                {isOpen && (
                                    <div className="grid gap-4 border-t bg-background/50 px-4 py-3 sm:grid-cols-2 md:px-14">
                                        {sections.map((section) => (
                                            <div key={section.title}>
                                                <p className="mb-1 text-2xs font-bold uppercase text-muted-foreground">
                                                    {section.title}
                                                </p>
                                                <ul className="flex flex-col gap-0.5 text-sm">
                                                    {section.items.map(
                                                        (text, i) => (
                                                            <li key={i}>
                                                                {text}
                                                            </li>
                                                        )
                                                    )}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ol>
            )}

            {dialog?.type === "groups" && (
                <DisplayGroupsModal
                    isOpen
                    onClose={() => setDialog(null)}
                    person={dialog.person}
                />
            )}
            {dialog?.type === "warnings" && (
                <DisplayWarningsModal
                    isOpen
                    onClose={() => setDialog(null)}
                    person={dialog.person}
                />
            )}
            {dialog?.type === "warn" && (
                <IssueWarningModal
                    isOpen
                    onClose={() => setDialog(null)}
                    person={dialog.person}
                />
            )}
        </div>
    );
};

export default MostMissedAssignments;
