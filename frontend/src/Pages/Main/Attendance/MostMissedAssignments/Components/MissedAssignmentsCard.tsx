import { FileText, FileWarning, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { getPersonFromWcif } from "wcif-helpers";

import Avatar from "@/Components/Avatar/Avatar";
import EventIcon from "@/Components/Icons/EventIcon";
import FlagIcon from "@/Components/Icons/FlagIcon";
import { Button } from "@/Components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/Components/ui/card";
import { activityCodeToName, prettyActivityName } from "@/lib/activities";
import { Competition, MissedAssignments } from "@/lib/interfaces";
import { isDelegate } from "@/lib/permissions";
import { WCA_ORIGIN } from "@/lib/request";
import DisplayGroupsModal from "@/Pages/Main/Persons/Components/DisplayGroupsModal";
import DisplayWarningsModal from "@/Pages/Main/Persons/Components/DisplayWarningsModal";
import IssueWarningModal from "@/Pages/Main/Persons/Components/IssueWarningModal";

interface MissedAssignmentsCardProps {
    assignments: MissedAssignments;
    competition: Competition;
}

const MissedAssignmentsCard = ({
    assignments,
    competition,
}: MissedAssignmentsCardProps) => {
    const [isOpenDisplayGroupsModal, setIsOpenDisplayGroupsModal] =
        useState<boolean>(false);
    const [isOpenDisplayWarningsModal, setIsOpenDisplayWarningsModal] =
        useState<boolean>(false);
    const [isOpenIssueWarningModal, setIsOpenIssueWarningModal] =
        useState<boolean>(false);

    const wcifInfo = getPersonFromWcif(
        assignments.person.registrantId || 0,
        competition.wcif
    );

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex gap-2 justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Avatar
                                avatarUrl={wcifInfo?.avatar?.thumbUrl}
                                fullAvatarUrl={wcifInfo?.avatar?.url}
                                username={assignments.person.name}
                            />
                            {assignments.person.wcaId ? (
                                <a
                                    className="text-blue-500"
                                    href={`${WCA_ORIGIN}/persons/${assignments.person.wcaId}`}
                                    target="_blank"
                                >
                                    {assignments.person.name} (
                                    {assignments.person.registrantId})
                                </a>
                            ) : (
                                `${assignments.person.name} (${
                                    assignments.person.registrantId &&
                                    `(${assignments.person.registrantId})`
                                }`
                            )}
                        </div>
                        {assignments.person.countryIso2 && (
                            <div className="flex items-center gap-1">
                                <FlagIcon
                                    country={assignments.person.countryIso2}
                                    size={40}
                                />
                            </div>
                        )}
                    </CardTitle>
                    <CardDescription>
                        <div className="flex flex-row gap-2 flex-wrap mt-2">
                            {wcifInfo?.registration?.eventIds.map(
                                (event: string) => (
                                    <EventIcon
                                        key={event}
                                        eventId={event}
                                        selected={true}
                                        size={20}
                                    />
                                )
                            )}
                        </div>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <h3>
                        Missed {assignments.missedAssignmentsCount} assignments
                    </h3>
                    <ul className="list-disc ml-8">
                        {assignments.missedAssignments.map((item) => (
                            <li>
                                {activityCodeToName(
                                    item.groupId,
                                    true,
                                    true,
                                    true
                                )}{" "}
                                - {prettyActivityName(item.role)}
                            </li>
                        ))}
                    </ul>
                    <h3>
                        Late for {assignments.lateAssignmentsCount} assignments
                    </h3>
                    <ul className="list-disc ml-8">
                        {assignments.lateAssignments.map((item) => (
                            <li>
                                {activityCodeToName(
                                    item.groupId,
                                    true,
                                    true,
                                    true
                                )}{" "}
                                - {prettyActivityName(item.role)}
                            </li>
                        ))}
                    </ul>
                    <h3>
                        Replaced by someone for{" "}
                        {assignments.presentButReplacedAssignmentsCount}{" "}
                        assignments
                    </h3>
                    <ul className="list-disc ml-8">
                        {assignments.presentButReplacedAssignments.map(
                            (item) => (
                                <li>
                                    {activityCodeToName(
                                        item.groupId,
                                        true,
                                        true,
                                        true
                                    )}{" "}
                                    - {prettyActivityName(item.role)}
                                </li>
                            )
                        )}
                    </ul>
                </CardContent>
                <CardFooter className="flex md:flex-row flex-col gap-2">
                    {isDelegate() && (
                        <>
                            <Button
                                onClick={() =>
                                    setIsOpenDisplayWarningsModal(true)
                                }
                                className="w-full md:w-fit"
                            >
                                <FileWarning />
                                Display all warnings for this person
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={() => setIsOpenIssueWarningModal(true)}
                                className="w-full md:w-fit"
                            >
                                <ShieldAlert />
                                Issue warning
                            </Button>
                        </>
                    )}
                    <Button
                        variant="success"
                        onClick={() => setIsOpenDisplayGroupsModal(true)}
                        className="w-full md:w-fit"
                    >
                        <FileText />
                        Groups
                    </Button>
                </CardFooter>
            </Card>
            <IssueWarningModal
                isOpen={isOpenIssueWarningModal}
                onClose={() => setIsOpenIssueWarningModal(false)}
                person={assignments.person}
            />
            <DisplayWarningsModal
                isOpen={isOpenDisplayWarningsModal}
                onClose={() => setIsOpenDisplayWarningsModal(false)}
                person={assignments.person}
            />
            {assignments.person.registrantId &&
                assignments.person.registrantId !== 0 && (
                    <DisplayGroupsModal
                        isOpen={isOpenDisplayGroupsModal}
                        onClose={() => setIsOpenDisplayGroupsModal(false)}
                        person={assignments.person}
                    />
                )}
        </>
    );
};

export default MissedAssignmentsCard;
