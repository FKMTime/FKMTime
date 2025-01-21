import { useState } from "react";

import wcaLogo from "@/assets/wca.svg";
import Avatar from "@/Components/Avatar/Avatar";
import RoleIcon from "@/Components/Icons/RoleIcon";
import { Button } from "@/Components/ui/button";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/Components/ui/card";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { User } from "@/lib/interfaces";
import { deleteUser } from "@/lib/user";
import { prettyUserRoleNameIncludingWCA } from "@/lib/utils";

import EditUserModal from "./EditUserModal";
import EditUserPasswordModal from "./EditUserPasswordModal";

interface UserCardProps {
    user: User;
    fetchData: () => void;
}

const UserCard = ({ user, fetchData }: UserCardProps) => {
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
            <Card>
                <CardHeader>
                    <CardTitle className="flex gap-2 justify-between items-center">
                        {user.fullName ? user.fullName : user.username}
                        <Avatar
                            avatarUrl={user.avatarUrl}
                            username={
                                user.fullName ? user.fullName : user.username
                            }
                        />
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2 items-center">
                        <span>
                            Role: {prettyUserRoleNameIncludingWCA(user)}
                        </span>
                        <RoleIcon role={user.role} />
                    </div>
                    <div className="flex gap-2 items-center">
                        Logged in with:{" "}
                        {isWcaAccount ? (
                            <img src={wcaLogo} width="16" />
                        ) : (
                            "FKM"
                        )}
                    </div>
                    <p>
                        Updated at: {new Date(user.updatedAt).toLocaleString()}
                    </p>
                </CardContent>
                <CardFooter className="flex gap-2">
                    <Button onClick={() => setIsOpenEditUserModal(true)}>
                        Edit
                    </Button>
                    {!isWcaAccount && (
                        <Button
                            variant="secondary"
                            onClick={() => setIsOpenChangePasswordModal(true)}
                        >
                            Change password
                        </Button>
                    )}
                    <Button variant="destructive" onClick={handleDelete}>
                        Delete
                    </Button>
                </CardFooter>
            </Card>
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

export default UserCard;
