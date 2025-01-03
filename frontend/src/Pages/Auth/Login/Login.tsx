import { Box } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import background from "@/assets/background.jpg";
import logo from "@/assets/logo.svg";
import { toaster } from "@/Components/ui/toaster";
import { login, loginWithWca } from "@/logic/auth";
import { WCA_CLIENT_ID, WCA_ORIGIN } from "@/logic/request.ts";
import LoginForm from "@/Pages/Auth/Login/Components/LoginForm";

import MobileLogin from "./MobileLogin";

const Login = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code");
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState<boolean>(code ? true : false);

    const handleSubmit = async (username: string, password: string) => {
        const status = await login(username, password);
        handleLoginResponse(status);
    };

    const handleLoginResponse = useCallback(
        (status: number, errorMessage?: string) => {
            setIsLoading(false);
            if (status === 200) {
                toaster.create({
                    title: "Successfully logged in.",
                    description: "You have been successfully logged in.",
                    type: "success",
                });
                navigate("/");
            } else if (status === 401) {
                toaster.create({
                    title: "Error",
                    description: "Wrong username or password",
                    type: "error",
                });
            } else {
                toaster.create({
                    title: "Error",
                    description: errorMessage || "Something went wrong",
                    type: "error",
                });
            }
        },
        [navigate]
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
        <>
            <Box display={{ base: "block", lg: "none" }}>
                <MobileLogin
                    handleSubmit={handleSubmit}
                    handleWcaLogin={handleWcaLogin}
                    isLoading={isLoading}
                />
            </Box>
            <Box
                display={{ base: "none", lg: "flex" }}
                backgroundColor="gray.800"
                width="100%"
                height="100vh"
            >
                <Box
                    width="30%"
                    p={5}
                    alignItems="center"
                    justifyContent="center"
                    display="flex"
                    flexDirection="column"
                >
                    <img src={logo} width="300" alt="logo" />
                    <LoginForm
                        handleLogin={handleSubmit}
                        handleWcaLogin={handleWcaLogin}
                        isLoading={isLoading}
                    />
                </Box>
                <img
                    src={background}
                    alt="background"
                    width="100%"
                    height="100%"
                    style={{ objectFit: "cover" }}
                />
            </Box>
        </>
    );
};

export default Login;
