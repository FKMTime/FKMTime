import { KeyRound, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";

import GiveDelegateAccessModal from "@/Components/GiveDelegateAccessModal";
import RowActions from "@/Components/shared/RowActions";
import { TableCell, TableRow } from "@/Components/ui/table";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { grantableUsers } from "@/lib/delegateGrants";
import { Room, User } from "@/lib/interfaces";
import { stageLeadRoomsLabel } from "@/lib/stageLeadRooms";
import { deleteUser } from "@/lib/user";
import { prettyUserRoleName } from "@/lib/utils";

import EditUserModal from "./EditUserModal";
import EditUserPasswordModal from "./EditUserPasswordModal";

interface UserRowProps {
    user: User;
    fetchData: () => void;
    /** Desktop table row, or a mobile list item */
    variant?: "table" | "list";
    /** Groups delegate access can be given for; empty hides the action */
    accessGroupIds?: string[];
    /** The competition's rooms, in schedule order */
    rooms?: Room[];
}

const UserRow = ({
    user,
    fetchData,
    variant = "table",
    accessGroupIds = [],
    rooms = [],
}: UserRowProps) => {
    const { toast } = useToast();
    const confirm = useConfirm();
    const [isOpenEditUserModal, setIsOpenEditUserModal] =
        useState<boolean>(false);
    const [isOpenChangePasswordModal, setIsOpenChangePasswordModal] =
        useState<boolean>(false);
    const [isGivingAccess, setIsGivingAccess] = useState(false);
    const isWcaAccount = user.wcaUserId !== null;
    // Delegates and admins can do it all already
    const canGiveAccess =
        accessGroupIds.length > 0 && grantableUsers([user]).length > 0;

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
                    label: "Give delegate access…",
                    icon: ShieldCheck,
                    hidden: !canGiveAccess,
                    onSelect: () => setIsGivingAccess(true),
                },
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
    // "Stage leader · Main Hall": where they take attendance (SPEC-016)
    const roomsLabel = stageLeadRoomsLabel(user, rooms);
    const roles = user.roles.map((role) => (
        <span
            key={role}
            className="whitespace-nowrap rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-foreground"
        >
            {prettyUserRoleName(role)}
            {role === "STAGE_LEADER" && roomsLabel && ` · ${roomsLabel}`}
        </span>
    ));
    const modals = (
        <>
            <EditUserModal
                isOpen={isOpenEditUserModal}
                onClose={handleCloseEditUserModal}
                user={user}
                rooms={rooms}
            />
            <EditUserPasswordModal
                isOpen={isOpenChangePasswordModal}
                onClose={() => setIsOpenChangePasswordModal(false)}
                user={user}
            />
            {isGivingAccess && (
                <GiveDelegateAccessModal
                    isOpen
                    onClose={() => setIsGivingAccess(false)}
                    groupIds={accessGroupIds}
                    user={user}
                />
            )}
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
