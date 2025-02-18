import { Lock } from "lucide-react";
import { useState } from "react";

import wcaLogo from "@/assets/wca.svg";
import DeleteButton from "@/Components/DeleteButton";
import EditButton from "@/Components/EditButton";
import SmallIconButton from "@/Components/SmallIconButton";
import { TableCell, TableRow } from "@/Components/ui/table";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { User } from "@/lib/interfaces";
import { deleteUser } from "@/lib/user";
import { prettyUserRoleName } from "@/lib/utils";

import EditUserModal from "./EditUserModal";
import EditUserPasswordModal from "./EditUserPasswordModal";

interface UserRowProps {
    user: User;
    fetchData: () => void;
}

const UserRow = ({ user, fetchData }: UserRowProps) => {
    const { toast } = useToast();
    const confirm = useConfirm();
    const [isOpenEditUserModal, setIsOpenEditUserModal] =
        useState<boolean>(false);
    const [isOpenChangePasswordModal, setIsOpenChangePasswordModal] =
        useState<boolean>(false);
    const isWcaAccount = user.wcaUserId !== null;

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
                    });
                    fetchData();
                } else {
                    toast({
                        title: "Error",
                        description: "Something went wrong",
                        variant: "destructive",
                    });
                }
            })
            .catch(() => {
                toast({
                    title: "Cancelled",
                    description:
                        "You have cancelled the deletion of this user.",
                });
            });
    };

    return (
        <>
            <TableRow key={user.id}>
                <TableCell>
                    {isWcaAccount ? <img src={wcaLogo} width="25" /> : "FKM"}
                </TableCell>
                <TableCell>{user.fullName}</TableCell>
                <TableCell>
                    {user.roles
                        .map((role) => prettyUserRoleName(role))
                        .join(", ")}
                </TableCell>
                <TableCell>
                    <EditButton onClick={() => setIsOpenEditUserModal(true)} />
                    {!isWcaAccount && (
                        <SmallIconButton
                            icon={<Lock />}
                            title="Change password"
                            onClick={() => setIsOpenChangePasswordModal(true)}
                        />
                    )}
                    <DeleteButton onClick={handleDelete} />
                </TableCell>
            </TableRow>
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
