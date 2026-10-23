import { UserPlus } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/Components/ui/button";
import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { useIsMobile } from "@/hooks/useMobile";
import { User } from "@/lib/interfaces";
import { getAllUsers } from "@/lib/user";
import SetupTabs from "@/Pages/Main/Setup/SetupTabs";

import CreateUserModal from "./Components/CreateUser/CreateUserModal";
import UserRow from "./Components/UserRow";

const Users = () => {
    const isMobile = useIsMobile();
    const [users, setUsers] = useState<User[]>([]);
    const [isOpenCreateUserModal, setIsOpenCreateUserModal] =
        useState<boolean>(false);

    const fetchData = async () => {
        const data = await getAllUsers();
        setUsers(data);
    };

    const handleCloseCreateUserModal = async () => {
        await fetchData();
        setIsOpenCreateUserModal(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <>
            <SetupTabs value="users" />
            <Button
                onClick={() => setIsOpenCreateUserModal(true)}
                variant={isMobile ? "outline" : "default"}
                size={isMobile ? "lg" : "default"}
                className="md:ml-auto md:w-fit"
            >
                <UserPlus />
                Create user
            </Button>
            {isMobile ? (
                <ul className="overflow-hidden rounded-mobile-card border bg-card">
                    {users.map((user) => (
                        <UserRow
                            key={user.id}
                            user={user}
                            fetchData={fetchData}
                            variant="list"
                        />
                    ))}
                </ul>
            ) : (
                <div className="overflow-hidden rounded-2xl border bg-card">
                    <Table className="min-w-[640px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-5">
                                    Full name
                                </TableHead>
                                <TableHead>Account type</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>
                                    <span className="sr-only">Actions</span>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((user) => (
                                <UserRow
                                    key={user.id}
                                    user={user}
                                    fetchData={fetchData}
                                />
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
            <CreateUserModal
                isOpen={isOpenCreateUserModal}
                onClose={handleCloseCreateUserModal}
            />
        </>
    );
};

export default Users;
