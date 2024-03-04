import { Box, IconButton, Td, Tr } from "@chakra-ui/react";
import { Person } from "../../../logic/interfaces";
import { Competition } from "@wca/helpers";
import { FaAddressCard } from "react-icons/fa";
import { MdAssignment, MdBarChart, MdDone } from "react-icons/md";
import {
    getPersonFromWcif,
    prettyGender,
    regionNameByIso2,
} from "../../../logic/utils";
import { useState } from "react";
import AssignCardModal from "../../Modal/AssignCardModal";
import EventIcon from "../../Icons/EventIcon";
import DisplayGroupsModal from "../../Modal/DisplayGroupsModal";
import { useNavigate } from "react-router-dom";

interface PersonRowProps {
    person: Person;
    wcif: Competition;
    handleCloseEditModal: () => void;
}

const PersonRow: React.FC<PersonRowProps> = ({
    person,
    wcif,
    handleCloseEditModal,
}) => {
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
                <Td>{person.name}</Td>
                <Td>{person.wcaId}</Td>
                <Td>{regionNameByIso2(person.countryIso2!)}</Td>
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
                <Td>{person.giftpackCollectedAt && <MdDone />}</Td>
                <Td>{person.canCompete && <MdDone />}</Td>
                <Td>
                    <IconButton
                        icon={<FaAddressCard />}
                        aria-label="Card"
                        bg="none"
                        color="white"
                        _hover={{
                            background: "none",
                            color: "gray.400",
                        }}
                        title="Assign card"
                        onClick={() => setIsOpenAssignCardModal(true)}
                    />
                    {person.registrantId && person.registrantId !== 0 && (
                        <>
                            <IconButton
                                icon={<MdAssignment />}
                                aria-label="Groups"
                                bg="none"
                                color="white"
                                _hover={{
                                    background: "none",
                                    color: "gray.400",
                                }}
                                title="Display groups"
                                onClick={() =>
                                    setIsOpenDisplayGroupsModal(true)
                                }
                            />
                            <IconButton
                                icon={<MdBarChart />}
                                aria-label="Results"
                                bg="none"
                                color="white"
                                _hover={{
                                    background: "none",
                                    color: "gray.400",
                                }}
                                title="Display all results for this person"
                                onClick={() =>
                                    navigate(`/persons/${person.id}/results`)
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
                    wcif={wcif}
                    registrationId={person.registrantId}
                />
            )}
        </>
    );
};

export default PersonRow;
