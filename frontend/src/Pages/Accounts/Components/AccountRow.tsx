import { Box, IconButton, Td, Text, Tr, useToast } from "@chakra-ui/react";
import { useConfirm } from "chakra-ui-confirm";
import { useState } from "react";
import { MdDelete, MdEdit, MdLock } from "react-icons/md";

import wcaLogo from "@/assets/wca.svg";
import RoleIcon from "@/Components/Icons/RoleIcon.tsx";
import { deleteAccount } from "@/logic/accounts";
import { Account } from "@/logic/interfaces";
import { prettyAccountRoleName } from "@/logic/utils.ts";

import EditAccountModal from "./EditAccountModal";
import EditAccountPasswordModal from "./EditAccountPasswordModal";

interface AccountRowProps {
    account: Account;
    fetchData: () => void;
}

const AccountRow = ({ account, fetchData }: AccountRowProps) => {
    const toast = useToast();
    const confirm = useConfirm();
    const [isOpenEditAccountModal, setIsOpenEditAccountModal] =
        useState<boolean>(false);
    const [isOpenChangePasswordModal, setIsOpenChangePasswordModal] =
        useState<boolean>(false);

    const handleCloseEditAccountModal = async () => {
        await fetchData();
        setIsOpenEditAccountModal(false);
    };

    const handleDelete = async () => {
        confirm({
            title: "Delete account",
            description:
                "Are you sure you want to delete this account? This action cannot be undone",
        })
            .then(async () => {
                const status = await deleteAccount(account.id);
                if (status === 204) {
                    toast({
                        title: "Successfully deleted account.",
                        status: "success",
                        duration: 9000,
                        isClosable: true,
                    });
                    fetchData();
                } else {
                    toast({
                        title: "Error",
                        description: "Something went wrong",
                        status: "error",
                        duration: 9000,
                        isClosable: true,
                    });
                }
            })
            .catch(() => {
                toast({
                    title: "Cancelled",
                    description:
                        "You have cancelled the deletion of the account.",
                    status: "info",
                    duration: 9000,
                    isClosable: true,
                });
            });
    };

    return (
        <>
            <Tr key={account.id}>
                <Td>
                    {account.wcaUserId ? (
                        <img src={wcaLogo} width="25" />
                    ) : (
                        "FKM"
                    )}
                </Td>
                <Td>{account.fullName}</Td>
                <Td>
                    <Box display="flex" alignItems="center" gap="1">
                        <Text>{prettyAccountRoleName(account.role)}</Text>
                        <RoleIcon role={account.role} />
                    </Box>
                </Td>
                <Td>
                    <IconButton
                        icon={<MdEdit />}
                        title="Edit"
                        aria-label="Edit"
                        bg="none"
                        color="white"
                        _hover={{
                            background: "none",
                            color: "gray.400",
                        }}
                        onClick={() => setIsOpenEditAccountModal(true)}
                    />
                    {!account.wcaUserId && (
                        <IconButton
                            icon={<MdLock />}
                            title="Change password"
                            aria-label="Change password"
                            bg="none"
                            color="white"
                            _hover={{
                                background: "none",
                                color: "gray.400",
                            }}
                            onClick={() => setIsOpenChangePasswordModal(true)}
                        />
                    )}
                    <IconButton
                        icon={<MdDelete />}
                        title="Delete"
                        aria-label="Delete"
                        bg="none"
                        color="white"
                        _hover={{
                            background: "none",
                            color: "gray.400",
                        }}
                        onClick={handleDelete}
                    />
                </Td>
            </Tr>
            <EditAccountModal
                isOpen={isOpenEditAccountModal}
                onClose={handleCloseEditAccountModal}
                account={account}
            />
            <EditAccountPasswordModal
                isOpen={isOpenChangePasswordModal}
                onClose={() => setIsOpenChangePasswordModal(false)}
                account={account}
            />
        </>
    );
};

export default AccountRow;
