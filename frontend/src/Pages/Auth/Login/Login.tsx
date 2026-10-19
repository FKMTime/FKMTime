import { Tv } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import WordmarkHeader from "@/Components/shared/WordmarkHeader";
import { Button } from "@/Components/ui/button";
import { useToast } from "@/hooks/useToast";
import { isUserLoggedIn, login, loginWithWca } from "@/lib/auth";
import { getInfoForLoginPage } from "@/lib/competition";
import { CompetitionDataForLoginPage } from "@/lib/interfaces";
import { WCA_CLIENT_ID, WCA_ORIGIN } from "@/lib/request";
import { getScramblingDeviceTokenFromCode } from "@/lib/scramblingDevicesAuth";

import DeviceCodeForm from "./Components/DeviceCodeForm";
import SignInForm from "./Components/SignInForm";

type LoginMode = "signin" | "device";

const loginErrorMessage = (status: number, errorMessage?: string) =>
    status === 401
        ? "Wrong username or password"
        : errorMessage || "Something went wrong";

const deviceCodeErrorMessage = (status: number) =>
    status === 404 ? "Wrong code" : "Something went wrong";

const Login = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code");
    const navigate = useNavigate();
    const { toast } = useToast();
    const [mode, setMode] = useState<LoginMode>("signin");
    const [isLoading, setIsLoading] = useState<boolean>(code ? true : false);
    const [error, setError] = useState<string>("");
    const [competition, setCompetition] = useState<
        CompetitionDataForLoginPage | undefined
    >(undefined);

    const handleLoginResponse = useCallback(
        (status: number, errorMessage?: string) => {
            setIsLoading(false);
            if (status === 200) {
                navigate("/");
            } else {
                setError(loginErrorMessage(status, errorMessage));
            }
        },
        [navigate]
    );

    const handleSubmit = async (username: string, password: string) => {
        setIsLoading(true);
        const status = await login(username, password);
        handleLoginResponse(status);
    };

    const handleDeviceCode = async (deviceCode: string) => {
        setIsLoading(true);
        const status = await getScramblingDeviceTokenFromCode(deviceCode);
        setIsLoading(false);
        if (status === 201) {
            navigate("/scrambling-device");
        } else {
            setError(deviceCodeErrorMessage(status));
        }
    };

    const handleWcaLogin = async () => {
        const queryParams = new URLSearchParams({
            redirect_uri: `${window.location.origin}/auth/login`,
            scope: "public manage_competitions",
            response_type: "code",
            client_id: WCA_CLIENT_ID,
        });
        window.location.href = `${WCA_ORIGIN}/oauth/authorize?${queryParams.toString()}`;
    };

    const switchMode = (newMode: LoginMode) => {
        setMode(newMode);
        setError("");
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
                if (!code) setIsLoading(false);
            })
            .catch((status) => {
                if (status !== 404) {
                    toast({
                        title: "Error",
                        description: "Failed to fetch competition data.",
                        variant: "destructive",
                    });
                }
                if (!code) setIsLoading(false);
            });
    }, [code, toast]);

    const isDeviceMode = mode === "device";

    return (
        <div className="flex min-h-screen flex-col px-4 py-5 sm:px-6">
            <WordmarkHeader />
            <main className="flex flex-1 flex-col justify-center py-10">
                <div className="mx-auto flex w-full max-w-[400px] flex-col gap-6 rounded-2xl border bg-card p-7">
                    <div className="flex flex-col gap-1.5">
                        {competition?.name && (
                            <span className="text-[13px] font-semibold text-muted-foreground">
                                {competition.name}
                            </span>
                        )}
                        <h1 className="text-[28px] font-bold leading-[1.15] tracking-[-0.02em]">
                            {isDeviceMode ? "Scrambling device" : "Sign in"}
                        </h1>
                        <p className="text-pretty text-muted-foreground">
                            {isDeviceMode
                                ? "Enter the 6-digit code shown for this device in the dashboard."
                                : "Sign in with your FKMTime account or WCA account."}
                        </p>
                    </div>
                    {isDeviceMode ? (
                        <DeviceCodeForm
                            error={error}
                            isLoading={isLoading}
                            onSubmit={handleDeviceCode}
                            onChange={() => setError("")}
                            onBack={() => switchMode("signin")}
                        />
                    ) : (
                        <SignInForm
                            error={error}
                            isLoading={isLoading}
                            showScramblingDevice={
                                competition?.useFkmTimeDevices ?? false
                            }
                            onSubmit={handleSubmit}
                            onChange={() => setError("")}
                            onWcaLogin={handleWcaLogin}
                            onScramblingDevice={() => switchMode("device")}
                        />
                    )}
                </div>
            </main>
            <Button variant="ghost" className="self-center" asChild>
                <Link to="/public">
                    <Tv />
                    Public display
                </Link>
            </Button>
        </div>
    );
};

export default Login;
