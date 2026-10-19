import {
    ChartColumn,
    Check,
    FileText,
    Flag,
    IdCard,
    ShieldAlert,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getPersonFromWcif } from "wcif-helpers";

import Avatar from "@/Components/Avatar/Avatar";
import FlagIcon from "@/Components/Icons/FlagIcon";
import RowActions, { RowAction } from "@/Components/shared/RowActions";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { getEventIconClass } from "@/lib/events";
import { Competition, Person } from "@/lib/interfaces";
import {
    isDelegate,
    isStageLeaderOrOrganizerOrDelegate,
} from "@/lib/permissions";
import { WCA_ORIGIN } from "@/lib/request";
import { cn, prettyGender, regionNameByIso2 } from "@/lib/utils";

export type PersonDialog = "card" | "groups" | "warnings" | "issueWarning";

interface PersonsListProps {
    persons: Person[];
    competition: Competition;
    onOpenDialog: (dialog: PersonDialog, person: Person) => void;
}

const YesMark = ({ value, label }: { value: unknown; label: string }) =>
    value ? (
        <Check className="size-[18px] text-success" aria-label={label} />
    ) : (
        <span className="text-faint" aria-label={`Not ${label.toLowerCase()}`}>
            —
        </span>
    );

const PersonsList = ({
    persons,
    competition,
    onOpenDialog,
}: PersonsListProps) => {
    const navigate = useNavigate();
    const useDevices = competition.useFkmTimeDevices;

    const actions = (person: Person) => {
        const isRegistered = !!person.registrantId;
        const canSeeGroups =
            isRegistered && isStageLeaderOrOrganizerOrDelegate();
        const assignCard: RowAction = {
            label: "Assign card",
            icon: IdCard,
            onSelect: () => onOpenDialog("card", person),
        };
        const groups: RowAction = {
            label: "Groups",
            icon: FileText,
            hidden: !canSeeGroups,
            onSelect: () => onOpenDialog("groups", person),
        };
        const items: RowAction[] = [
            ...(useDevices ? [groups] : []),
            {
                label: "All results",
                icon: ChartColumn,
                hidden: !canSeeGroups || !useDevices,
                onSelect: () => navigate(`/persons/${person.id}/results`),
            },
            {
                label: "Warnings",
                icon: Flag,
                hidden: !isRegistered || !isDelegate(),
                onSelect: () => onOpenDialog("warnings", person),
            },
            {
                label: "Issue warning",
                icon: ShieldAlert,
                hidden: !isRegistered || !isDelegate(),
                onSelect: () => onOpenDialog("issueWarning", person),
            },
        ];
        return (
            <RowActions
                subject={person.name}
                primary={useDevices ? assignCard : groups}
                items={items}
            />
        );
    };

    const wcifPerson = (person: Person) =>
        person.registrantId
            ? getPersonFromWcif(person.registrantId, competition.wcif)
            : undefined;

    const avatar = (person: Person) => {
        const info = wcifPerson(person);
        return (
            <Avatar
                username={person.name}
                avatarUrl={info?.avatar?.thumbUrl}
                fullAvatarUrl={info?.avatar?.url}
            />
        );
    };

    const wcaId = (person: Person) =>
        person.wcaId ? (
            <a
                href={`${WCA_ORIGIN}/persons/${person.wcaId}`}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
            >
                {person.wcaId}
            </a>
        ) : (
            <span className="text-muted-foreground">Newcomer</span>
        );

    return (
        <>
            <div className="hidden overflow-x-auto rounded-2xl border bg-card md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="pl-5">ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>WCA ID</TableHead>
                            <TableHead>Representing</TableHead>
                            <TableHead>Gender</TableHead>
                            <TableHead>Events</TableHead>
                            {useDevices && <TableHead>Card</TableHead>}
                            <TableHead>Checked in</TableHead>
                            {useDevices && <TableHead>Can compete</TableHead>}
                            <TableHead>
                                <span className="sr-only">Actions</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {persons.map((person) => (
                            <TableRow key={person.id}>
                                <TableCell className="pl-5 text-muted-foreground">
                                    {person.registrantId}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2.5">
                                        {avatar(person)}
                                        <span className="font-semibold">
                                            {person.name}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>{wcaId(person)}</TableCell>
                                <TableCell>
                                    {person.countryIso2 && (
                                        <span className="flex items-center gap-2 whitespace-nowrap">
                                            <FlagIcon
                                                country={person.countryIso2}
                                                size={18}
                                            />
                                            {regionNameByIso2(
                                                person.countryIso2
                                            )}
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {prettyGender(person.gender)}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1.5">
                                        {wcifPerson(
                                            person
                                        )?.registration?.eventIds.map(
                                            (eventId: string) => (
                                                <span
                                                    key={eventId}
                                                    title={eventId}
                                                    className={cn(
                                                        "cubing-icon text-base",
                                                        getEventIconClass(
                                                            eventId
                                                        )
                                                    )}
                                                />
                                            )
                                        )}
                                    </div>
                                </TableCell>
                                {useDevices && (
                                    <TableCell>
                                        <YesMark
                                            value={person.cardId}
                                            label="Card assigned"
                                        />
                                    </TableCell>
                                )}
                                <TableCell>
                                    <YesMark
                                        value={person.checkedInAt}
                                        label="Checked in"
                                    />
                                </TableCell>
                                {useDevices && (
                                    <TableCell>
                                        <YesMark
                                            value={person.canCompete}
                                            label="Can compete"
                                        />
                                    </TableCell>
                                )}
                                <TableCell className="pr-3">
                                    {actions(person)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <ul className="flex flex-col divide-y overflow-hidden rounded-mobile-card border bg-card md:hidden">
                {persons.map((person) => (
                    <li
                        key={person.id}
                        className="flex items-center gap-3 py-3 pl-4 pr-1.5"
                    >
                        {avatar(person)}
                        <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">
                                {person.name}
                            </p>
                            <p className="truncate text-[13px] text-muted-foreground">
                                {[
                                    person.registrantId &&
                                        `ID ${person.registrantId}`,
                                    person.wcaId ?? "Newcomer",
                                    person.countryIso2 &&
                                        regionNameByIso2(person.countryIso2),
                                ]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </p>
                            <p className="text-xs text-faint">
                                {[
                                    useDevices && !person.cardId && "No card",
                                    !person.checkedInAt && "Not checked in",
                                ]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </p>
                        </div>
                        {actions(person)}
                    </li>
                ))}
            </ul>
        </>
    );
};

export default PersonsList;
