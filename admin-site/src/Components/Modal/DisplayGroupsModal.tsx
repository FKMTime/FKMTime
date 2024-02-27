import { Box, TableContainer, Table, Thead, Tr, Th, Tbody, Td } from "@chakra-ui/react";
import { getAssigmentsList } from "../../logic/activities";
import { Modal } from "./Modal";
import { Competition } from "@wca/helpers";

interface DisplayGroupsModalProops {
    isOpen: boolean;
    onClose: () => void;
    registrationId: number;
    wcif: Competition;
}

const DisplayGroupsModal: React.FC<DisplayGroupsModalProops> = ({ isOpen, onClose, wcif, registrationId }): JSX.Element => {

    const assigments = getAssigmentsList(registrationId, wcif);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Groups">
            <Box display="flex" flexDirection="column" gap="5">
                <TableContainer>
                    <Table variant='simple'>
                        <Thead>
                            <Tr bg='gray.400'>
                                <Th>Group</Th>
                                <Th>Activity</Th>
                            </Tr>
                        </Thead>
                        <Tbody>
                            {assigments.map((assigment) => (
                                <Tr>
                                    <Td>{assigment.groupName}</Td>
                                    <Td>{assigment.activityName}</Td>
                                </Tr>
                            ))}
                        </Tbody>
                    </Table>
                </TableContainer>
            </Box>
        </Modal>
    )
};

export default DisplayGroupsModal;
