import {
    Box,
    Button,
    FormControl,
    FormLabel,
    Input,
    useToast,
} from "@chakra-ui/react";
import { FormEvent, useState } from "react";

import { Modal } from "@/Components/Modal";
import Select from "@/Components/Select";
import { User, UserRole } from "@/logic/interfaces";
import { updateUser } from "@/logic/user";
import { prettyUserRoleName } from "@/logic/utils.ts";

interface EditUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User;
}

const EditUserModal = ({ isOpen, onClose, user }: EditUserModalProps) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [editedUser, setEditedUser] = useState<User>(user);
    const isWcaAccount = user.wcaUserId !== null;

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        setIsLoading(true);
        event.preventDefault();

        const status = await updateUser(editedUser);
        if (status === 200) {
            toast({
                title: "Successfully updated user.",
                status: "success",
            });
            onClose();
        } else if (status === 409) {
            toast({
                title: "Error",
                description: "Username already taken!",
                status: "error",
            });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                status: "error",
            });
        }
        setIsLoading(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit user">
            <Box
                display="flex"
                flexDirection="column"
                gap="5"
                as="form"
                onSubmit={handleSubmit}
            >
                {!isWcaAccount && (
                    <>
                        <FormControl isRequired>
                            <FormLabel>Username</FormLabel>
                            <Input
                                placeholder="Username"
                                _placeholder={{ color: "white" }}
                                value={editedUser.username}
                                disabled={isLoading}
                                onChange={(e) =>
                                    setEditedUser({
                                        ...editedUser,
                                        username: e.target.value,
                                    })
                                }
                            />
                        </FormControl>
                        <FormControl>
                            <FormLabel>Full name</FormLabel>
                            <Input
                                placeholder="Full name"
                                _placeholder={{ color: "white" }}
                                value={editedUser.fullName}
                                disabled={isLoading}
                                onChange={(e) =>
                                    setEditedUser({
                                        ...editedUser,
                                        fullName: e.target.value,
                                    })
                                }
                            />
                        </FormControl>
                    </>
                )}
                <FormControl isRequired>
                    <FormLabel>Role</FormLabel>
                    <Select
                        value={editedUser.role}
                        disabled={isLoading}
                        onChange={(e) =>
                            setEditedUser({
                                ...editedUser,
                                role: e.target.value,
                            })
                        }
                    >
                        {Object.keys(UserRole).map((userRole) => (
                            <option key={userRole} value={userRole}>
                                {prettyUserRoleName(userRole)}
                            </option>
                        ))}
                    </Select>
                </FormControl>
                <Box
                    display="flex"
                    flexDirection="row"
                    justifyContent="end"
                    gap="5"
                >
                    {!isLoading && (
                        <Button colorScheme="red" onClick={onClose}>
                            Cancel
                        </Button>
                    )}
                    <Button
                        colorScheme="green"
                        type="submit"
                        isLoading={isLoading}
                    >
                        Save
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
};

export default EditUserModal;
