import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { User } from "@/lib/interfaces";

import UserRow from "./UserRow";

interface UsersTableProps {
    users: User[];
    fetchData: () => void;
}

const UsersTable = ({ users, fetchData }: UsersTableProps) => {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Account type</TableHead>
                    <TableHead>Full name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {users.map((user) => (
                    <UserRow key={user.id} user={user} fetchData={fetchData} />
                ))}
            </TableBody>
        </Table>
    );
};

export default UsersTable;
