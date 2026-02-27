/* eslint-disable react-hooks/set-state-in-effect */
import { UserCog } from "lucide-react";
import { useEffect, useState } from "react";

import PlusButton from "@/Components/PlusButton.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { User } from "@/lib/interfaces";
import { getAllUsers } from "@/lib/user";
import PageTransition from "@/Pages/PageTransition";

import CreateUserModal from "./Components/CreateUser/CreateUserModal";
import UserCard from "./Components/UserCard";
import UsersTable from "./Components/UsersTable";

const Users = () => {
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
        <PageTransition>
            <div className="flex flex-col gap-5">
                <div className="flex md:hidden flex-col gap-3">
                    <PlusButton
                        aria-label="Add"
                        onClick={() => setIsOpenCreateUserModal(true)}
                    />
                    {users.map((user) => (
                        <UserCard
                            key={user.id}
                            user={user}
                            fetchData={fetchData}
                        />
                    ))}
                </div>
                <div className="hidden md:block">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex justify-between items-center">
                                <div className="flex gap-2 items-center">
                                    <UserCog size={20} />
                                    Users
                                </div>
                                <PlusButton
                                    aria-label="Add"
                                    onClick={() =>
                                        setIsOpenCreateUserModal(true)
                                    }
                                />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <UsersTable users={users} fetchData={fetchData} />
                        </CardContent>
                    </Card>
                </div>
                <CreateUserModal
                    isOpen={isOpenCreateUserModal}
                    onClose={handleCloseCreateUserModal}
                />
            </div>
        </PageTransition>
    );
};

export default Users;
