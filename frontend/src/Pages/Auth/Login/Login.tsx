import {
    Box,
    Button,
    Flex,
    FormControl,
    FormLabel,
    Heading,
    Icon,
    Input,
    useToast,
    VStack,
} from "@chakra-ui/react";
import { FormEvent } from "react";
import { FaLock } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import { login } from "@/logic/auth";

const Login = () => {
    const navigate = useNavigate();
    const toast = useToast();

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);

        if (data.get("password") && data.get("username")) {
            const username = data.get("username") as string;
            const password = data.get("password") as string;

            const status = await login(username, password);

            if (status === 200) {
                toast({
                    title: "Successfully logged in.",
                    description: "You have been successfully logged in.",
                    status: "success",
                    duration: 9000,
                    isClosable: true,
                });
                navigate("/");
            } else if (status === 401) {
                toast({
                    title: "Error",
                    description: "Wrong username or password",
                    status: "error",
                    duration: 9000,
                    isClosable: true,
                });
            } else {
                toast({
                    title: "Error",
                    description: "Something went wrong",
                    status: "error",
                    duration: 9000,
                    isClosable: true,
                });
            }
        }
    };

    return (
        <Flex
            height="100vh"
            alignItems="center"
            justifyContent="center"
            color="white"
            backgroundImage="https://source.unsplash.com/random/?city,night"
            backgroundSize="cover"
            backgroundPosition="center"
            backgroundRepeat="no-repeat"
            backgroundAttachment="fixed"
        >
            <VStack
                spacing={4}
                align="center"
                p={10}
                backgroundColor="rgba(0,0,0,0.8)"
                borderRadius="md"
            >
                <Icon as={FaLock} color="white" />
                <Heading fontSize="xl" fontWeight="bold">
                    Sign in
                </Heading>
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
                    </VStack>
                </Box>
            </VStack>
        </Flex>
    );
};

export default Login;
