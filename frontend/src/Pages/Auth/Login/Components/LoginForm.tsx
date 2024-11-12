import {
    Box,
    Button,
    FormControl,
    FormLabel,
    HStack,
    Input,
    PinInput,
    PinInputField,
    useToast,
    VStack,
} from "@chakra-ui/react";
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import wca from "@/assets/wca.svg";
import { getScramblingDeviceTokenFromCode } from "@/logic/scramblingDevicesAuth";

interface LoginFormProps {
    handleLogin: (username: string, password: string) => void;
    handleWcaLogin: () => void;
    isLoading?: boolean;
}
const LoginForm = ({
    handleLogin,
    handleWcaLogin,
    isLoading,
}: LoginFormProps) => {
    const toast = useToast();
    const navigate = useNavigate();
    const [enableScramblingDeviceLogin, setEnableScramblingDeviceLogin] =
        useState<boolean>(false);
    const [code, setCode] = useState<string>("");

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const username = data.get("username") as string;
        const password = data.get("password") as string;
        handleLogin(username, password);
    };

    const handleScramblingDeviceLogin = async () => {
        const status = await getScramblingDeviceTokenFromCode(code);
        if (status === 201) {
            toast({
                title: "Successfully logged in.",
                description: "You have been successfully logged in.",
                status: "success",
            });
            navigate("/scrambling-device");
        } else if (status === 404) {
            toast({
                title: "Error",
                description: "Wrong code",
                status: "error",
            });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                status: "error",
            });
        }
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
                {enableScramblingDeviceLogin ? (
                    <>
                        <Box
                            display="flex"
                            flexDirection="column"
                            gap={3}
                            alignItems="center"
                        >
                            <Button
                                colorScheme="teal"
                                onClick={() =>
                                    setEnableScramblingDeviceLogin(false)
                                }
                                width="100%"
                                isDisabled={isLoading}
                            >
                                Sign in
                            </Button>
                            <FormLabel>Enter one-time code</FormLabel>

                            <HStack alignItems="center">
                                <PinInput
                                    size="lg"
                                    value={code}
                                    onChange={setCode}
                                >
                                    <PinInputField />
                                    <PinInputField />
                                    <PinInputField />
                                    <PinInputField />
                                    <PinInputField />
                                    <PinInputField />
                                </PinInput>
                            </HStack>
                            <Button
                                colorScheme="green"
                                onClick={handleScramblingDeviceLogin}
                                isDisabled={isLoading}
                            >
                                Submit
                            </Button>
                        </Box>
                    </>
                ) : (
                    <>
                        <Button
                            colorScheme="purple"
                            mt={3}
                            isDisabled={isLoading}
                            onClick={() => setEnableScramblingDeviceLogin(true)}
                        >
                            Scrambling device
                        </Button>
                        <FormControl isRequired>
                            <FormLabel>Username</FormLabel>
                            <Input
                                type="text"
                                placeholder="Enter username"
                                name="username"
                                isDisabled={isLoading}
                            />
                        </FormControl>
                        <FormControl isRequired>
                            <FormLabel>Password</FormLabel>
                            <Input
                                type="password"
                                placeholder="Enter password"
                                name="password"
                                isDisabled={isLoading}
                            />
                        </FormControl>
                        <VStack spacing={4} align="stretch" mt={3}>
                            <Button
                                colorScheme="green"
                                type="submit"
                                isDisabled={isLoading}
                            >
                                Sign in
                            </Button>
                            <Button
                                colorScheme="blue"
                                mt={3}
                                display="flex"
                                gap="3"
                                onClick={handleWcaLogin}
                                isLoading={isLoading}
                            >
                                <img src={wca} alt="WCA" width="25" />
                                Sign in with WCA
                            </Button>
                        </VStack>
                    </>
                )}
            </Box>
        </>
    );
};

export default LoginForm;
