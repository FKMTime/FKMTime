import {
    Box,
    Button,
    FormControl,
    FormLabel,
    Input,
    Tab,
    TabList,
    TabPanel,
    TabPanels,
    Tabs,
    useToast,
} from "@chakra-ui/react";
import { useState } from "react";

import { Modal } from "@/Components/Modal";
import PasswordInput from "@/Components/PasswordInput.tsx";
import Select from "@/Components/Select";
import { NewUserData, UserRole } from "@/logic/interfaces.ts";
import { createUser } from "@/logic/user";
import { prettyUserRoleName } from "@/logic/utils.ts";

import WCAPersonsAutocomplete from "./WCAPersonsAutocomplete";

interface CreateUserModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CreateUserModal = ({ isOpen, onClose }: CreateUserModalProps) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [userData, setUserData] = useState<NewUserData>({
        fullName: "",
        role: UserRole.ADMIN,
    });

    const handleSubmit = async () => {
        setIsLoading(true);
        const response = await createUser(userData);
        if (response.status === 201) {
            toast({
                title: "Success",
                description: "User has been created successfully.",
                status: "success",
            });
            onClose();
        } else if (response.status === 409) {
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
        <Modal isOpen={isOpen} onClose={onClose} title="Create user">
            <Box
                display="flex"
                flexDirection="column"
                gap="5"
                onSubmit={handleSubmit}
            >
                <Tabs isFitted variant="enclosed">
                    <TabList>
                        <Tab
                            _selected={{
                                color: "white",
                                bg: "blue.500",
                            }}
                        >
                            FKM Account
                        </Tab>
                        <Tab
                            _selected={{
                                color: "white",
                                bg: "blue.500",
                            }}
                        >
                            WCA Login
                        </Tab>
                    </TabList>
                    <TabPanels>
                        <TabPanel>
                            <Box display="flex" gap="5" flexDirection="column">
                                <FormControl isRequired>
                                    <FormLabel>Username</FormLabel>
                                    <Input
                                        placeholder="Username"
                                        _placeholder={{ color: "white" }}
                                        value={userData.username}
                                        onChange={(e) =>
                                            setUserData({
                                                ...userData,
                                                username: e.target.value,
                                            })
                                        }
                                        disabled={isLoading}
                                    />
                                </FormControl>
                                <FormControl>
                                    <FormLabel>Full name</FormLabel>
                                    <Input
                                        placeholder="Full name"
                                        _placeholder={{ color: "white" }}
                                        value={userData.fullName}
                                        onChange={(e) =>
                                            setUserData({
                                                ...userData,
                                                fullName: e.target.value,
                                            })
                                        }
                                        isDisabled={isLoading}
                                    />
                                </FormControl>
                                <FormControl isRequired>
                                    <FormLabel>Password</FormLabel>
                                    <PasswordInput
                                        placeholder="Password"
                                        isDisabled={isLoading}
                                        value={userData.password}
                                        onChange={(e) =>
                                            setUserData({
                                                ...userData,
                                                password: e.target.value,
                                            })
                                        }
                                    />
                                </FormControl>
                                <FormControl isRequired>
                                    <FormLabel>Role</FormLabel>
                                    <Select
                                        value={userData.role}
                                        onChange={(e) =>
                                            setUserData({
                                                ...userData,
                                                role: e.target
                                                    .value as UserRole,
                                            })
                                        }
                                        disabled={isLoading}
                                        placeholder="Select role"
                                    >
                                        {Object.keys(UserRole).map(
                                            (userRole) => (
                                                <option
                                                    key={userRole}
                                                    value={userRole}
                                                >
                                                    {prettyUserRoleName(
                                                        userRole
                                                    )}
                                                </option>
                                            )
                                        )}
                                    </Select>
                                </FormControl>
                            </Box>
                        </TabPanel>
                        <TabPanel>
                            <Box display="flex" gap="5" flexDirection="column">
                                <WCAPersonsAutocomplete
                                    value={userData.wcaId || ""}
                                    onSelect={(person) =>
                                        setUserData({
                                            ...userData,
                                            wcaId: person.wcaId,
                                            fullName: person.name,
                                        })
                                    }
                                />
                                <FormControl isRequired>
                                    <FormLabel>Role</FormLabel>
                                    <Select
                                        value={userData.role}
                                        onChange={(e) =>
                                            setUserData({
                                                ...userData,
                                                role: e.target
                                                    .value as UserRole,
                                            })
                                        }
                                        disabled={isLoading}
                                        placeholder="Select role"
                                    >
                                        {Object.keys(UserRole).map(
                                            (userRole) => (
                                                <option
                                                    key={userRole}
                                                    value={userRole}
                                                >
                                                    {prettyUserRoleName(
                                                        userRole
                                                    )}
                                                </option>
                                            )
                                        )}
                                    </Select>
                                </FormControl>
                            </Box>
                        </TabPanel>
                    </TabPanels>
                </Tabs>

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
                        onClick={handleSubmit}
                        isLoading={isLoading}
                    >
                        Submit
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
};

export default CreateUserModal;
