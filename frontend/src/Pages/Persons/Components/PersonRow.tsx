import { Box, Link, Td, Text, Tr } from "@chakra-ui/react";
import { Competition } from "@wca/helpers";
import { useState } from "react";
import { FaAddressCard } from "react-icons/fa";
import { MdAssignment, MdBarChart, MdDone } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { getPersonFromWcif } from "wcif-helpers";

import Avatar from "@/Components/Avatar/Avatar";
import EventIcon from "@/Components/Icons/EventIcon";
import FlagIcon from "@/Components/Icons/FlagIcon.tsx";
import SmallIconButton from "@/Components/SmallIconButton";
import { isAdmin } from "@/logic/auth.ts";
import { Person } from "@/logic/interfaces";
import { WCA_ORIGIN } from "@/logic/request";
import { prettyGender, regionNameByIso2 } from "@/logic/utils";

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
        <>
            <Tr key={person.id}>
                <Td>{person.registrantId}</Td>
                <Td>
                    <Box display="flex" alignItems="center" gap="1">
                        <Avatar
                            avatarSize={30}
                            avatarUrl={wcifInfo?.avatar?.thumbUrl}
                            fullAvatarUrl={wcifInfo?.avatar?.url}
                            username={person.name}
                        />
                        <Text>{person.name}</Text>
                    </Box>
                </Td>
                <Td>
                    <Link
                        target="_blank"
                        href={`${WCA_ORIGIN}/persons/${person.wcaId}`}
                    >
                        {person.wcaId}
                    </Link>
                </Td>
                <Td>
                    {person.countryIso2 && (
                        <Box display="flex" alignItems="center" gap="1">
                            <FlagIcon country={person.countryIso2} size={20} />
                            <Text>{regionNameByIso2(person.countryIso2)}</Text>
                        </Box>
                    )}
                </Td>
                <Td>{prettyGender(person.gender)}</Td>
                <Td>
                    <Box display="flex" flexDirection="row" gap="2">
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
                    </Box>
                </Td>
                <Td>{person.cardId && <MdDone />}</Td>
                <Td>{person.checkedInAt && <MdDone />}</Td>
                <Td>{person.canCompete && <MdDone />}</Td>
                <Td>
                    <SmallIconButton
                        icon={<FaAddressCard />}
                        ariaLabel="Card"
                        title="Assign card"
                        onClick={() => setIsOpenAssignCardModal(true)}
                    />
                    {person.registrantId &&
                        person.registrantId !== 0 &&
                        isAdmin() && (
                            <>
                                <SmallIconButton
                                    icon={<MdAssignment />}
                                    ariaLabel="Groups"
                                    title="Display groups"
                                    onClick={() =>
                                        setIsOpenDisplayGroupsModal(true)
                                    }
                                />
                                <SmallIconButton
                                    icon={<MdBarChart />}
                                    ariaLabel="Results"
                                    title="Display all results for this person"
                                    onClick={() =>
                                        navigate(
                                            `/persons/${person.id}/results`
                                        )
                                    }
                                />
                            </>
                        )}
                </Td>
            </Tr>
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

export default PersonRow;
