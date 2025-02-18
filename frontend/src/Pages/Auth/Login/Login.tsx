import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import background from "@/assets/background.jpg";
import logo from "@/assets/logo.svg";
import { useToast } from "@/hooks/useToast";
import { login, loginWithWca } from "@/lib/auth";
import { WCA_CLIENT_ID, WCA_ORIGIN } from "@/lib/request";
import LoginForm from "@/Pages/Auth/Login/Components/LoginForm";

import MobileLogin from "./MobileLogin";

const Login = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code");
    const navigate = useNavigate();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState<boolean>(code ? true : false);

    const handleSubmit = async (username: string, password: string) => {
        const status = await login(username, password);
        handleLoginResponse(status);
    };

    const handleLoginResponse = useCallback(
        (status: number, errorMessage?: string) => {
            setIsLoading(false);
            if (status === 200) {
                toast({
                    title: "Successfully logged in.",
                    description: "You have been successfully logged in.",
                    variant: "success",
                });
                navigate("/");
            } else if (status === 401) {
                toast({
                    title: "Error",
                    description: "Wrong username or password",
                    variant: "destructive",
                });
            } else {
                toast({
                    title: "Error",
                    description: errorMessage || "Something went wrong",
                    variant: "destructive",
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
        <>
            <div className="block lg:hidden">
                <MobileLogin
                    handleSubmit={handleSubmit}
                    handleWcaLogin={handleWcaLogin}
                    isLoading={isLoading}
                />
            </div>
            <div className="hidden lg:flex w-full h-screen">
                <div className="w-[30%] pl-5 pr-5 flex items-center justify-center flex-col gap-5">
                    <img src={logo} width="300" alt="logo" />
                    <LoginForm
                        handleLogin={handleSubmit}
                        handleWcaLogin={handleWcaLogin}
                        isLoading={isLoading}
                    />
                </div>
                <img
                    src={background}
                    alt="background"
                    width="100%"
                    height="100%"
                    style={{ objectFit: "cover" }}
                />
            </div>
        </>
    );
};

export default Login;
