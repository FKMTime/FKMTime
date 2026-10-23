import { KeyRound, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import RowActions from "@/Components/shared/RowActions";
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
    /** Desktop table row, or a mobile list item */
    variant?: "table" | "list";
}

const UserRow = ({ user, fetchData, variant = "table" }: UserRowProps) => {
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
                // Declined: closing the dialog is feedback enough
            });
    };

    const accountType = isWcaAccount ? "WCA" : "FKMTime";
    const name = user.fullName ?? user.username ?? "User";
    const actions = (
        <RowActions
            subject={name}
            primary={{
                label: "Edit user",
                icon: Pencil,
                onSelect: () => setIsOpenEditUserModal(true),
            }}
            items={[
                {
                    label: "Change password",
                    icon: KeyRound,
                    hidden: isWcaAccount,
                    onSelect: () => setIsOpenChangePasswordModal(true),
                },
                {
                    label: "Delete user",
                    icon: Trash2,
                    destructive: true,
                    onSelect: handleDelete,
                },
            ]}
        />
    );
    const roles = user.roles.map((role) => (
        <span
            key={role}
            className="whitespace-nowrap rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-foreground"
        >
            {prettyUserRoleName(role)}
        </span>
    ));
    const modals = (
        <>
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

    if (variant === "list")
        return (
            <li className="flex items-center gap-2.5 border-b py-2 pl-3.5 pr-1 last:border-b-0">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-semibold">
                        {name}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
                        {accountType} ·{roles}
                    </span>
                </div>
                {actions}
                {modals}
            </li>
        );

    return (
        <TableRow>
            <TableCell className="pl-5 font-semibold">{name}</TableCell>
            <TableCell className="text-muted-foreground">
                {accountType}
            </TableCell>
            <TableCell>
                <div className="flex flex-wrap gap-1.5">{roles}</div>
            </TableCell>
            <TableCell className="pr-3">
                {actions}
                {modals}
            </TableCell>
        </TableRow>
    );
};

export default UserRow;
