import { IconButton, Td, Tr, useToast } from "@chakra-ui/react";
import { useState } from "react";
import { MdDelete, MdEdit, MdLock } from "react-icons/md";

import Alert from "@/Components/Alert";
import { deleteAccount } from "@/logic/accounts";
import { Account } from "@/logic/interfaces";

import EditAccountModal from "./EditAccountModal";
import EditAccountPasswordModal from "./EditAccountPasswordModal";

interface AccountRowProps {
    account: Account;
    fetchData: () => void;
}

const AccountRow = ({ account, fetchData }: AccountRowProps) => {
    const toast = useToast();
    const [openConfirmation, setOpenConfirmation] = useState<boolean>(false);
    const [isOpenEditAccountModal, setIsOpenEditAccountModal] =
        useState<boolean>(false);
    const [isOpenChangePasswordModal, setIsOpenChangePasswordModal] =
        useState<boolean>(false);

    const handleDelete = async () => {
        setOpenConfirmation(true);
    };

    const handleCancel = () => {
        setOpenConfirmation(false);
    };

    const handleCloseEditAccountModal = async () => {
        await fetchData();
        setIsOpenEditAccountModal(false);
    };

    const handleConfirm = async () => {
        setOpenConfirmation(false);
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
    };

    return (
        <>
            <Tr key={account.id}>
                <Td>{account.username}</Td>
                <Td>
                    {account.role.charAt(0).toUpperCase() +
                        account.role.slice(1).toLowerCase()}
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
            <Alert
                isOpen={openConfirmation}
                onCancel={handleCancel}
                onConfirm={handleConfirm}
                title="Delete Account"
                description="Are you sure?"
            />
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
