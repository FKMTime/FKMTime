import { Box, Input, VStack } from "@chakra-ui/react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import wca from "@/assets/wca.svg";
import { Button } from "@/Components/ui/button";
import { Field } from "@/Components/ui/field";
import { PinInput } from "@/Components/ui/pin-input";
import { toaster } from "@/Components/ui/toaster";
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
    const navigate = useNavigate();
    const [enableScramblingDeviceLogin, setEnableScramblingDeviceLogin] =
        useState<boolean>(false);
    const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
    const [username, setUsername] = useState<string>("");
    const [password, setPassword] = useState<string>("");

    const handleSubmit = () => {
        handleLogin(username, password);
    };

    const handleScramblingDeviceLogin = async () => {
        const status = await getScramblingDeviceTokenFromCode(code.join(""));
        if (status === 201) {
            toaster.create({
                title: "Successfully logged in.",
                description: "You have been successfully logged in.",
                type: "success",
            });
            navigate("/scrambling-device");
        } else if (status === 404) {
            toaster.create({
                title: "Error",
                description: "Scrambling device not found",
                type: "error",
            });
        } else {
            toaster.create({
                title: "Error",
                description: "Something went wrong",
                type: "error",
            });
        }
    };

    return (
        <>
            <Box width="100%" display="flex" flexDirection="column" gap={3}>
                {enableScramblingDeviceLogin ? (
                    <>
                        <Box
                            display="flex"
                            flexDirection="column"
                            gap={3}
                            alignItems="center"
                            justifyContent="center"
                        >
                            <Button
                                onClick={() =>
                                    setEnableScramblingDeviceLogin(false)
                                }
                                width="100%"
                                disabled={isLoading}
                            >
                                Sign in
                            </Button>
                            <Field
                                label="Enter one-time code"
                                justifyContent="center"
                                display="flex"
                                alignItems="center"
                            >
                                <PinInput
                                    size="lg"
                                    type="numeric"
                                    autoFocus
                                    count={6}
                                    value={code}
                                    onValueChange={(e) => setCode(e.value)}
                                />
                            </Field>
                            <Button
                                colorPalette="green"
                                onClick={handleScramblingDeviceLogin}
                                disabled={isLoading}
                            >
                                Submit
                            </Button>
                        </Box>
                    </>
                ) : (
                    <>
                        <Button
                            colorPalette="purple"
                            mt={3}
                            disabled={isLoading}
                            onClick={() => setEnableScramblingDeviceLogin(true)}
                        >
                            Scrambling device
                        </Button>
                        <Field required label="Username">
                            <Input
                                type="text"
                                placeholder="Enter username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                disabled={isLoading}
                            />
                        </Field>
                        <Field required label="Password">
                            <Input
                                type="password"
                                placeholder="Enter password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isLoading}
                            />
                        </Field>
                        <VStack gap={4} align="stretch" mt={3}>
                            <Button
                                disabled={isLoading}
                                onClick={handleSubmit}
                                colorPalette="green"
                            >
                                Sign in
                            </Button>
                            <Button
                                colorPalette="cyan"
                                mt={3}
                                display="flex"
                                gap="3"
                                onClick={handleWcaLogin}
                                disabled={isLoading}
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
