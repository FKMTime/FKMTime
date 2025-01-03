import {
    Avatar,
    Box,
    Button,
    ButtonGroup,
    Card,
    CardBody,
    CardFooter,
    Divider,
    Heading,
    Stack,
    Text,
    useToast,
} from "@chakra-ui/react";
import { useConfirm } from "chakra-ui-confirm";
import { useState } from "react";

import wcaLogo from "@/assets/wca.svg";
import RoleIcon from "@/Components/Icons/RoleIcon";
import { User } from "@/logic/interfaces";
import { deleteUser } from "@/logic/user";
import { prettyUserRoleNameIncludingWCA } from "@/logic/utils";

import EditUserModal from "./EditUserModal";
import EditUserPasswordModal from "./EditUserPasswordModal";

interface UserCardProps {
    user: User;
    fetchData: () => void;
}

const UserCard = ({ user, fetchData }: UserCardProps) => {
    const toast = useToast();
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
            <Card backgroundColor="gray.400">
                <CardBody>
                    <Box
                        display="flex"
                        gap={2}
                        alignItems="center"
                        justifyContent="space-between"
                    >
                        <Box display="flex" gap={2} alignItems="center">
                            <Avatar
                                src={user.avatarUrl}
                                name={
                                    user.fullName
                                        ? user.fullName
                                        : user.username
                                }
                            />
                            <Heading size="md">{user.fullName} </Heading>
                        </Box>
                        <Box display="flex" alignItems="center" gap="1">
                            <Heading size="sm">
                                {prettyUserRoleNameIncludingWCA(user)}
                            </Heading>
                            <RoleIcon role={user.role} />
                        </Box>
                    </Box>
                    <Stack mt="6" spacing="3">
                        <Box display="flex" gap={1}>
                            <Text>Logged in with: </Text>
                            {isWcaAccount ? (
                                <img src={wcaLogo} width="25" />
                            ) : (
                                <Text>FKM</Text>
                            )}
                        </Box>
                        <Text>
                            Updated at:{" "}
                            {new Date(user.updatedAt).toLocaleString()}
                        </Text>
                    </Stack>
                </CardBody>
                <Divider />
                <CardFooter>
                    <ButtonGroup spacing="2">
                        <Button
                            variant="solid"
                            colorPalette="blue"
                            onClick={() => setIsOpenEditUserModal(true)}
                        >
                            Edit
                        </Button>
                        {!isWcaAccount && (
                            <Button
                                variant="solid"
                                colorPalette="purple"
                                onClick={() =>
                                    setIsOpenChangePasswordModal(true)
                                }
                            >
                                Change password
                            </Button>
                        )}
                        <Button
                            variant="solid"
                            colorPalette="red"
                            onClick={handleDelete}
                        >
                            Delete
                        </Button>
                    </ButtonGroup>
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
