import { Box, Table, TableContainer, Tbody, Text, Th, Thead, Tr } from "@chakra-ui/react";
import { Competition, Person } from "../../logic/interfaces";
import Pagination from "./Pagination";
import PersonRow from "./Row/PersonRow";
import { getPersonFromWcif } from "../../logic/utils";

interface PersonsTableProps {
    persons: Person[];
    competition?: Competition;
    handleCloseEditModal: () => void;
    changePageSize: (pageSize: number) => void;
    handlePageChange: (page: number) => void;
    page: number;
    totalPages: number;
    pageSize: number;
}

const PersonsTable: React.FC<PersonsTableProps> = ({ persons, competition, handleCloseEditModal, changePageSize, handlePageChange, page, totalPages, pageSize }): JSX.Element => {
    if (!persons || persons.length === 0) {
        return (
            <Box textAlign="center">
                <Text>No persons found</Text>
            </Box>
        );
    }
    return (
        <>
            <TableContainer>
                <Table variant='simple'>
                    <Thead>
                        <Tr bg='gray.400'>
                            <Th>Registrant ID</Th>
                            <Th>Name</Th>
                            <Th>WCA ID</Th>
                            <Th>Representing</Th>
                            <Th>Gender</Th>
                            <Th>Events</Th>
                            <Th>Card assigned</Th>
                            <Th>Actions</Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {competition && persons.map((person: Person) => (
                            <PersonRow wcifInfo={getPersonFromWcif(person.registrantId, competition?.wcif)} wcif={competition.wcif} key={person.id} person={person} handleCloseEditModal={handleCloseEditModal} />
                        ))}
                    </Tbody>
                </Table>
            </TableContainer>
            <Pagination page={page} totalPages={totalPages} handlePageChange={handlePageChange} changePageSize={changePageSize} pageSize={pageSize} />
        </>
    );

};

export default PersonsTable;
