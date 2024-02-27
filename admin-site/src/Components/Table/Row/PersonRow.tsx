import { Tr, Td, IconButton, Box } from "@chakra-ui/react";
import { Person } from "../../../logic/interfaces";
import { Competition, Person as WcifPerson } from "@wca/helpers";
import { FaAddressCard } from "react-icons/fa";
import { MdAssignment, MdDone } from "react-icons/md";
import { prettyGender, regionNameByIso2 } from "../../../logic/utils";
import { useState } from "react";
import AssignCardModal from "../../Modal/AssignCardModal";
import EventIcon from "../../Icons/EventIcon";
import DisplayGroupsModal from "../../Modal/DisplayGroupsModal";

interface PersonRowProps {
    person: Person;
    wcif: Competition;
    wcifInfo?: WcifPerson;
    handleCloseEditModal: () => void;
}

const PersonRow: React.FC<PersonRowProps> = ({ person, wcif, wcifInfo, handleCloseEditModal }): JSX.Element => {

    const [isOpenAssignCardModal, setIsOpenAssignCardModal] = useState<boolean>(false);
    const [isOpenDisplayGroupsModal, setIsOpenDisplayGroupsModal] = useState<boolean>(false);

    const handleCloseAssignCardModal = async () => {
        await handleCloseEditModal();
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
                        {wcifInfo?.registration?.eventIds.map((event: string) => (
                            <EventIcon key={event} eventId={event} selected={true} size={20} />
                        ))}
                    </Box>
                </Td>
                <Td>{person.cardId && <MdDone />}</Td>
                <Td>
                    <IconButton icon={<FaAddressCard />} aria-label="Card" bg="none" color="white" _hover={{
                        background: "none",
                        color: "gray.400"
                    }}
                        onClick={() => setIsOpenAssignCardModal(true)}
                    />
                    <IconButton icon={<MdAssignment />} aria-label="Groups" bg="none" color="white" _hover={{
                        background: "none",
                        color: "gray.400"
                    }}
                        onClick={() => setIsOpenDisplayGroupsModal(true)}
                    />
                </Td>
            </Tr>
            <AssignCardModal isOpen={isOpenAssignCardModal} onClose={handleCloseAssignCardModal} person={person} />
            <DisplayGroupsModal isOpen={isOpenDisplayGroupsModal} onClose={() => setIsOpenDisplayGroupsModal(false)} wcif={wcif} registrationId={person.registrantId} />
        </>
    )
};

export default PersonRow;
