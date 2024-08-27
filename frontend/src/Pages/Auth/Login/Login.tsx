import { Flex, useToast, VStack } from "@chakra-ui/react";
import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import logo from "@/assets/logo.svg";
import { login, loginWithWca } from "@/logic/auth";
import { WCA_CLIENT_ID, WCA_ORIGIN } from "@/logic/request.ts";
import LoginForm from "@/Pages/Auth/Components/LoginForm.tsx";

const Login = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code");
    const navigate = useNavigate();
    const toast = useToast();

    const handleSubmit = async (username: string, password: string) => {
        const status = await login(username, password);
        handleLoginResponse(status);
    };

    const handleLoginResponse = useCallback(
        (status: number, errorMessage?: string) => {
            if (status === 200) {
                toast({
                    title: "Successfully logged in.",
                    description: "You have been successfully logged in.",
                    status: "success",
                });
                navigate("/");
            } else if (status === 401) {
                toast({
                    title: "Error",
                    description: "Wrong username or password",
                    status: "error",
                });
            } else {
                toast({
                    title: "Error",
                    description: errorMessage || "Something went wrong",
                    status: "error",
                });
            }
        },
        [navigate, toast]
    );

    const handleWcaLogin = async () => {
        const queryParams = new URLSearchParams({
            redirect_uri: `${window.location.origin}/auth/login`,
            scope: "public manage_competitions",
            response_type: "code",
            client_id: WCA_CLIENT_ID,
        });
        window.location.href = `${WCA_ORIGIN}/oauth/authorize?${queryParams.toString()}`;
    };

    const handleCode = useCallback(async () => {
        if (code) {
            const res = await loginWithWca(code, window.location.href);
            handleLoginResponse(res.status, res.data.message);
        }
    }, [code, handleLoginResponse]);

    useEffect(() => {
        handleCode();
    }, [code, handleCode, navigate]);

    return (
        <Flex
            height="100vh"
            alignItems="center"
            justifyContent="center"
            color="white"
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
                <img src={logo} width="150" alt="logo" />
                <LoginForm
                    handleLogin={handleSubmit}
                    handleWcaLogin={handleWcaLogin}
                />
            </VStack>
        </Flex>
    );
};

export default Login;
