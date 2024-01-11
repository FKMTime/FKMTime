import { Box, Button, FormControl, FormLabel, Input, Select, useToast } from "@chakra-ui/react";
import { Modal } from "./Modal";
import { updateAccount } from "../../logic/accounts";
import { useState } from "react";
import { Account } from "../../logic/interfaces";

interface EditAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    account: Account;
}

const EditAccountModal: React.FC<EditAccountModalProps> = ({ isOpen, onClose, account }): JSX.Element => {

    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [editedAccount, setEditedAccount] = useState<Account>(account);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        setIsLoading(true);
        event.preventDefault();
    
        const status = await updateAccount(editedAccount);
        if (status === 200) {
            toast({
                title: "Successfully updated account.",
                status: "success",
                duration: 9000,
                isClosable: true,
            });
            onClose();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                status: "error",
                duration: 9000,
                isClosable: true,
            });
        }
        setIsLoading(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create Account">
            <Box display="flex" flexDirection="column" gap="5" as="form" onSubmit={handleSubmit}>
                <FormControl isRequired>
                    <FormLabel>Username</FormLabel>
                    <Input placeholder='Username' _placeholder={{ color: "white" }} value={editedAccount.username} disabled={isLoading} onChange={(e) => setEditedAccount({ ...editedAccount, username: e.target.value })} />
                </FormControl>
                <FormControl isRequired>
                    <FormLabel>Email</FormLabel>
                    <Input placeholder='Email' type="email" _placeholder={{ color: "white" }} value={editedAccount.email} disabled={isLoading} onChange={(e) => setEditedAccount({ ...editedAccount, email: e.target.value })} />
                </FormControl>
                <FormControl isRequired>
                    <FormLabel>Role</FormLabel>
                    <Select placeholder='Select role' _placeholder={{ color: "white" }} value={editedAccount.role} disabled={isLoading} onChange={(e) => setEditedAccount({ ...editedAccount, role: e.target.value })}>
                        <option value='DELEGATE'>Delegate</option>
                        <option value='ADMIN'>Admin</option>
                    </Select>
                </FormControl>
                <Box display="flex" flexDirection="row" justifyContent="end" gap="5">
                    {!isLoading && (
                        <Button colorScheme='red' onClick={onClose}>
                            Cancel
                        </Button>
                    )}
                    <Button colorScheme='green' type="submit" isLoading={isLoading}>Save</Button>
                </Box>
            </Box>
        </Modal >
    )
};

export default EditAccountModal;
