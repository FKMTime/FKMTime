import { Table, TableContainer, Tbody, Th, Thead, Tr } from "@chakra-ui/react";
import { Competition, Person } from "../../logic/interfaces";
import Pagination from "./Pagination";
import PersonRow from "./Row/PersonRow";
import { getPersonFromWcif } from "../../logic/utils";

interface PersonsTableProps {
    persons: Person[];
    competition?: Competition;
    fetchData: () => void;
    changePageSize: (pageSize: number) => void;
    handlePageChange: (page: number) => void;
    page: number;
    totalPages: number;
    pageSize: number;
}

const PersonsTable: React.FC<PersonsTableProps> = ({ persons, competition, fetchData, changePageSize, handlePageChange, page, totalPages, pageSize }): JSX.Element => {
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
                        {persons.map((person: Person) => (
                            <PersonRow wcifInfo={getPersonFromWcif(person.registrantId, competition?.wcif)} key={person.id} person={person} fetchData={fetchData} />
                        ))}
                    </Tbody>
                </Table>
            </TableContainer>
            <Pagination page={page} totalPages={totalPages} handlePageChange={handlePageChange} changePageSize={changePageSize} pageSize={pageSize} />
        </>
    );

};

export default PersonsTable;
