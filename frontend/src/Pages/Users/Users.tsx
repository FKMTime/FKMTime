import { Box } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import PlusButton from "@/Components/PlusButton.tsx";
import { User } from "@/logic/interfaces";
import { getAllUsers } from "@/logic/user";

import CreateUserModal from "./Components/CreateUserModal";
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
        <Box display="flex" flexDirection="column" gap="5">
            <PlusButton
                aria-label="Add"
                onClick={() => setIsOpenCreateUserModal(true)}
            />
            <UsersTable users={users} fetchData={fetchData} />
            <CreateUserModal
                isOpen={isOpenCreateUserModal}
                onClose={handleCloseCreateUserModal}
            />
        </Box>
    );
};

export default Users;
