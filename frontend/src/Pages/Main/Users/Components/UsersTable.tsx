import { Table, TableContainer, Tbody, Th, Thead, Tr } from "@chakra-ui/react";

import { User } from "@/logic/interfaces";

import UserRow from "./UserRow";

interface UsersTableProps {
    users: User[];
    fetchData: () => void;
}

const UsersTable = ({ users, fetchData }: UsersTableProps) => {
    return (
        <TableContainer>
            <Table variant="simple">
                <Thead>
                    <Tr bg="gray.400">
                        <Th>Account type</Th>
                        <Th>Full name</Th>
                        <Th>Role</Th>
                        <Th>Actions</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {users.map((user) => (
                        <UserRow
                            key={user.id}
                            user={user}
                            fetchData={fetchData}
                        />
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    );
};

export default UsersTable;
