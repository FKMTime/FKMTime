import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import background from "@/assets/background.jpg";
import logo from "@/assets/logo.svg";
import { useToast } from "@/hooks/useToast";
import { isUserLoggedIn, login, loginWithWca } from "@/lib/auth";
import { getInfoForLoginPage } from "@/lib/competition";
import { CompetitionDataForLoginPage } from "@/lib/interfaces";
import { WCA_CLIENT_ID, WCA_ORIGIN } from "@/lib/request";
import LoginForm from "@/Pages/Auth/Login/Components/LoginForm";

import MobileLogin from "./MobileLogin";

const Login = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code");
    const navigate = useNavigate();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState<boolean>(code ? true : false);
    const [competition, setCompetition] = useState<
        CompetitionDataForLoginPage | undefined
    >(undefined);

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

    useEffect(() => {
        const isLoggedIn = async () => {
            if (await isUserLoggedIn()) {
                navigate("/");
            }
        };
        isLoggedIn();
    }, [navigate]);

    useEffect(() => {
        getInfoForLoginPage()
            .then((data) => {
                setCompetition(data);
                setIsLoading(false);
            })
            .catch((error) => {
                if (error !== 404) {
                    toast({
                        title: "Error",
                        description: "Failed to fetch competition data.",
                        variant: "destructive",
                    });
                }
                setIsLoading(false);
            });
    }, [toast]);
    return (
        <>
            <div className="block lg:hidden">
                <MobileLogin
                    handleSubmit={handleSubmit}
                    handleWcaLogin={handleWcaLogin}
                    isLoading={isLoading}
                    competition={competition}
                />
            </div>
            <div className="hidden lg:flex w-full h-screen">
                <div className="w-[30%] pl-5 pr-5 flex items-center justify-center flex-col gap-5">
                    <img src={logo} width="300" alt="logo" />
                    <h2 className="text-2xl font-bold text-center">
                        {competition?.name}
                    </h2>
                    <LoginForm
                        handleLogin={handleSubmit}
                        handleWcaLogin={handleWcaLogin}
                        isLoading={isLoading}
                        competition={competition}
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
