import {
    Box,
    Table,
    TableContainer,
    Tbody,
    Text,
    Th,
    Thead,
    Tr,
} from "@chakra-ui/react";

import Pagination from "@/Components/Pagination";
import { Competition, Person } from "@/lib/interfaces";

import PersonRow from "./PersonRow";

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

const PersonsTable = ({
    persons,
    competition,
    handleCloseEditModal,
    changePageSize,
    handlePageChange,
    page,
    totalPages,
    pageSize,
}: PersonsTableProps) => {
    if (!persons || persons.length === 0) {
        return (
            <Box textAlign="center">
                <Text>No persons found</Text>
            </Box>
        );
    }
    return (
        <Box display="flex" flexDirection="column" gap={4}>
            <TableContainer>
                <Table variant="simple">
                    <Thead>
                        <TableRow bg="gray.400">
                            <TableHead>Registrant ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>WCA ID</TableHead>
                            <TableHead>Representing</TableHead>
                            <TableHead>Gender</TableHead>
                            <TableHead>Events</TableHead>
                            <TableHead>Card assigned</TableHead>
                            <TableHead>Checked in</TableHead>
                            <TableHead>Can compete</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </Thead>
                    <TableBody>
                        {competition &&
                            persons.map((person: Person) => (
                                <PersonRow
                                    wcif={competition.wcif}
                                    key={person.id}
                                    person={person}
                                    handleCloseEditModal={handleCloseEditModal}
                                />
                            ))}
                    </Tbody>
                </Table>
            </TableContainer>
            <Pagination
                page={page}
                totalPages={totalPages}
                handlePageChange={handlePageChange}
                changePageSize={changePageSize}
                pageSize={pageSize}
            />
        </Box>
    );
};

export default PersonsTable;
