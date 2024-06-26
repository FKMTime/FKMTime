import { Table, TableContainer, Tbody, Th, Thead, Tr } from "@chakra-ui/react";

import { Account } from "@/logic/interfaces";

import AccountRow from "./AccountRow";

interface AccountsTableProps {
    accounts: Account[];
    fetchData: () => void;
}

const AccountsTable = ({ accounts, fetchData }: AccountsTableProps) => {
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
                    {accounts.map((account) => (
                        <AccountRow
                            key={account.id}
                            account={account}
                            fetchData={fetchData}
                        />
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    );
};

export default AccountsTable;
