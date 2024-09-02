import { Box, Td, Text, Tr, useToast } from "@chakra-ui/react";
import { useConfirm } from "chakra-ui-confirm";
import { useState } from "react";
import { MdLock } from "react-icons/md";

import wcaLogo from "@/assets/wca.svg";
import DeleteButton from "@/Components/DeleteButton";
import EditButton from "@/Components/EditButton";
import RoleIcon from "@/Components/Icons/RoleIcon.tsx";
import SmallIconButton from "@/Components/SmallIconButton";
import { User } from "@/logic/interfaces";
import { deleteUser } from "@/logic/user";
import { prettyUserRoleNameIncludingWCA } from "@/logic/utils.ts";

import EditUserModal from "./EditUserModal";
import EditUserPasswordModal from "./EditUserPasswordModal";

interface UserRowProps {
    user: User;
    fetchData: () => void;
}

const UserRow = ({ user, fetchData }: UserRowProps) => {
    const toast = useToast();
    const confirm = useConfirm();
    const [isOpenEditUserModal, setIsOpenEditUserModal] =
        useState<boolean>(false);
    const [isOpenChangePasswordModal, setIsOpenChangePasswordModal] =
        useState<boolean>(false);
    const isWcaAccount = user.wcaUserId || user.wcaId;

    const handleCloseEditUserModal = async () => {
        await fetchData();
        setIsOpenEditUserModal(false);
    };

    const handleDelete = async () => {
        confirm({
            title: "Delete user",
            description:
                "Are you sure you want to delete this user? This action cannot be undone",
        })
            .then(async () => {
                const status = await deleteUser(user.id);
                if (status === 204) {
                    toast({
                        title: "Successfully deleted user.",
                        status: "success",
                    });
                    fetchData();
                } else {
                    toast({
                        title: "Error",
                        description: "Something went wrong",
                        status: "error",
                    });
                }
            })
            .catch(() => {
                toast({
                    title: "Cancelled",
                    description:
                        "You have cancelled the deletion of this user.",
                    status: "info",
                });
            });
    };

    return (
        <>
            <Tr key={user.id}>
                <Td>
                    {isWcaAccount ? <img src={wcaLogo} width="25" /> : "FKM"}
                </Td>
                <Td>{user.fullName}</Td>
                <Td>
                    <Box display="flex" alignItems="center" gap="1">
                        <Text>{prettyUserRoleNameIncludingWCA(user)}</Text>
                        <RoleIcon role={user.role} />
                    </Box>
                </Td>
                <Td>
                    <EditButton onClick={() => setIsOpenEditUserModal(true)} />
                    {!isWcaAccount && (
                        <SmallIconButton
                            icon={<MdLock />}
                            title="Change password"
                            ariaLabel="Change password"
                            onClick={() => setIsOpenChangePasswordModal(true)}
                        />
                    )}
                    <DeleteButton onClick={handleDelete} />
                </Td>
            </Tr>
            <EditUserModal
                isOpen={isOpenEditUserModal}
                onClose={handleCloseEditUserModal}
                user={user}
            />
            <EditUserPasswordModal
                isOpen={isOpenChangePasswordModal}
                onClose={() => setIsOpenChangePasswordModal(false)}
                user={user}
            />
        </>
    );
};

export default UserRow;
