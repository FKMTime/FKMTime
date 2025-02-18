import { Competition } from "@wca/helpers";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPersonFromWcif } from "wcif-helpers";

import Avatar from "@/Components/Avatar/Avatar";
import EventIcon from "@/Components/Icons/EventIcon";
import FlagIcon from "@/Components/Icons/FlagIcon";
import { Button } from "@/Components/ui/button";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/Components/ui/card";
import { Person } from "@/lib/interfaces";
import { isStageLeaderOrOrganizerOrDelegate } from "@/lib/permissions";
import { WCA_ORIGIN } from "@/lib/request";
import { prettyGender, regionNameByIso2 } from "@/lib/utils";

import AssignCardModal from "./AssignCardModal";
import DisplayGroupsModal from "./DisplayGroupsModal";

interface PersonCardProps {
    person: Person;
    wcif: Competition;
    handleCloseEditModal: () => void;
}

const PersonCard = ({
    person,
    wcif,
    handleCloseEditModal,
}: PersonCardProps) => {
    const navigate = useNavigate();
    const [isOpenAssignCardModal, setIsOpenAssignCardModal] =
        useState<boolean>(false);
    const [isOpenDisplayGroupsModal, setIsOpenDisplayGroupsModal] =
        useState<boolean>(false);
    const wcifInfo = person.registrantId
        ? getPersonFromWcif(person.registrantId, wcif)
        : null;

    const handleCloseAssignCardModal = async () => {
        handleCloseEditModal();
        setIsOpenAssignCardModal(false);
    };
    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex gap-2 justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Avatar
                                avatarUrl={wcifInfo?.avatar?.thumbUrl}
                                fullAvatarUrl={wcifInfo?.avatar?.url}
                                username={person.name}
                            />
                            {person.name}{" "}
                            {person.registrantId && `(${person.registrantId})`}
                        </div>
                        {person.countryIso2 && (
                            <div className="flex items-center gap-1">
                                <FlagIcon
                                    country={person.countryIso2}
                                    size={40}
                                />
                            </div>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {person.wcaId && (
                        <p>
                            WCA ID:{" "}
                            <a
                                className="text-blue-500"
                                href={`${WCA_ORIGIN}/persons/${person.wcaId}`}
                                target="_blank"
                            >
                                {person.wcaId}
                            </a>
                        </p>
                    )}
                    {person.countryIso2 && (
                        <p>
                            Representing: {regionNameByIso2(person.countryIso2)}
                        </p>
                    )}
                    <p>Gender: {prettyGender(person.gender)}</p>
                    <p>Card assigned: {person.cardId ? "Yes" : "No"}</p>
                    <p>Checked in: {person.checkedInAt ? "Yes" : "No"}</p>
                    <p>Can compete: {person.canCompete ? "Yes" : "No"}</p>
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
                </CardContent>
                <CardFooter className="flex gap-2">
                    <Button onClick={() => setIsOpenAssignCardModal(true)}>
                        Assign card
                    </Button>
                    {person.registrantId &&
                        person.registrantId !== 0 &&
                        isStageLeaderOrOrganizerOrDelegate() && (
                            <>
                                <Button
                                    onClick={() =>
                                        setIsOpenDisplayGroupsModal(true)
                                    }
                                >
                                    Groups
                                </Button>
                                <Button
                                    onClick={() =>
                                        navigate(
                                            `/persons/${person.id}/results`
                                        )
                                    }
                                >
                                    Results
                                </Button>
                            </>
                        )}
                </CardFooter>
            </Card>
            <AssignCardModal
                isOpen={isOpenAssignCardModal}
                onClose={handleCloseAssignCardModal}
                person={person}
            />
            {person.registrantId && person.registrantId !== 0 && (
                <DisplayGroupsModal
                    isOpen={isOpenDisplayGroupsModal}
                    onClose={() => setIsOpenDisplayGroupsModal(false)}
                    person={person}
                />
            )}
        </>
    );
};

export default PersonCard;
