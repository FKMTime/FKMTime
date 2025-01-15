import { Competition } from "@wca/helpers";
import {
    ChartNoAxesColumn,
    Check,
    FileText,
    IdCard,
    PersonStanding,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPersonFromWcif } from "wcif-helpers";

import Avatar from "@/Components/Avatar/Avatar";
import EventIcon from "@/Components/Icons/EventIcon";
import FlagIcon from "@/Components/Icons/FlagIcon.tsx";
import SmallIconButton from "@/Components/SmallIconButton";
import Tooltip from "@/Components/Tooltip";
import { TableCell, TableRow } from "@/Components/ui/table";
import { isAdmin } from "@/lib/auth";
import { Person } from "@/lib/interfaces";
import { WCA_ORIGIN } from "@/lib/request";
import { prettyGender, regionNameByIso2 } from "@/lib/utils";

import AssignCardModal from "./AssignCardModal";
import DisplayGroupsModal from "./DisplayGroupsModal";

interface PersonRowProps {
    person: Person;
    wcif: Competition;
    handleCloseEditModal: () => void;
}

const PersonRow = ({ person, wcif, handleCloseEditModal }: PersonRowProps) => {
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
        <TableRow key={person.id}>
            <TableCell>{person.registrantId}</TableCell>
            <TableCell>
                <div className="flex items-center gap-2">
                    <Avatar
                        avatarUrl={wcifInfo?.avatar?.thumbUrl}
                        fullAvatarUrl={wcifInfo?.avatar?.url}
                        username={person.name}
                    />
                    <p>{person.name}</p>
                </div>
            </TableCell>
            <TableCell>
                {person.wcaId ? (
                    <a
                        className="text-blue-500"
                        href={`${WCA_ORIGIN}/persons/${person.wcaId}`}
                        target="_blank"
                    >
                        {person.wcaId}
                    </a>
                ) : person.canCompete ? (
                    <Tooltip content="Newcomer">
                        <PersonStanding />
                    </Tooltip>
                ) : null}
            </TableCell>
            <TableCell>
                {person.countryIso2 && (
                    <div className="flex items-center gap-2">
                        <FlagIcon country={person.countryIso2} size={20} />
                        <p>{regionNameByIso2(person.countryIso2)}</p>
                    </div>
                )}
            </TableCell>
            <TableCell>{prettyGender(person.gender)}</TableCell>
            <TableCell>
                <div className="flex gap-2">
                    {wcifInfo?.registration?.eventIds.map((event: string) => (
                        <EventIcon
                            key={event}
                            eventId={event}
                            selected={true}
                            size={20}
                        />
                    ))}
                </div>
            </TableCell>
            <TableCell>{person.cardId && <Check />}</TableCell>
            <TableCell>{person.checkedInAt && <Check />}</TableCell>
            <TableCell>{person.canCompete && <Check />}</TableCell>
            <TableCell>
                <SmallIconButton
                    icon={<IdCard />}
                    title="Assign card"
                    onClick={() => setIsOpenAssignCardModal(true)}
                />
                {person.registrantId &&
                    person.registrantId !== 0 &&
                    isAdmin() && (
                        <>
                            <SmallIconButton
                                icon={<FileText />}
                                title="Display groups"
                                onClick={() =>
                                    setIsOpenDisplayGroupsModal(true)
                                }
                            />
                            <SmallIconButton
                                icon={<ChartNoAxesColumn />}
                                title="Display all results for this person"
                                onClick={() =>
                                    navigate(`/persons/${person.id}/results`)
                                }
                            />
                        </>
                    )}
            </TableCell>
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
        </TableRow>
    );
};

export default PersonRow;
