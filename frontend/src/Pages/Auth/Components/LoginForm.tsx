import {
    Box,
    Button,
    FormControl,
    FormLabel,
    Input,
    VStack,
} from "@chakra-ui/react";
import { FormEvent } from "react";

import wca from "@/assets/wca.svg";

interface LoginFormProps {
    handleLogin: (username: string, password: string) => void;
    handleWcaLogin: () => void;
}
const LoginForm = ({ handleLogin, handleWcaLogin }: LoginFormProps) => {
    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const username = data.get("username") as string;
        const password = data.get("password") as string;
        handleLogin(username, password);
    };

    return (
        <>
            <Box
                as="form"
                width="100%"
                display="flex"
                flexDirection="column"
                gap={3}
                onSubmit={handleSubmit}
            >
                <FormControl isRequired>
                    <FormLabel>Username</FormLabel>
                    <Input
                        type="text"
                        placeholder="Enter username"
                        name="username"
                    />
                </FormControl>
                <FormControl isRequired>
                    <FormLabel>Password</FormLabel>
                    <Input
                        type="password"
                        placeholder="Enter password"
                        name="password"
                    />
                </FormControl>
                <VStack spacing={4} align="stretch" mt={3}>
                    <Button colorScheme="teal" type="submit">
                        Sign in
                    </Button>
                    <Button
                        colorScheme="blue"
                        mt={3}
                        display="flex"
                        gap="3"
                        onClick={handleWcaLogin}
                    >
                        <img src={wca} alt="WCA" width="25" />
                        Sign in with WCA
                    </Button>
                </VStack>
            </Box>
        </>
    );
};

export default LoginForm;
