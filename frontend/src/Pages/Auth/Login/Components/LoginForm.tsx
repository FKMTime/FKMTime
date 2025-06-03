import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import wca from "@/assets/wca.svg";
import { Button } from "@/Components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/Components/ui/form";
import { Input } from "@/Components/ui/input";
import { useToast } from "@/hooks/useToast";
import { CompetitionDataForLoginPage } from "@/lib/interfaces";
import { loginFormSchema } from "@/lib/schema/authSchema";
import { getScramblingDeviceTokenFromCode } from "@/lib/scramblingDevicesAuth";

import ScramblingDeviceForm from "./ScramblingDeviceForm";

interface LoginFormProps {
    handleLogin: (username: string, password: string) => void;
    handleWcaLogin: () => void;
    isLoading?: boolean;
    competition?: CompetitionDataForLoginPage;
}
const LoginForm = ({
    handleLogin,
    handleWcaLogin,
    isLoading,
    competition,
}: LoginFormProps) => {
    const { toast } = useToast();
    const navigate = useNavigate();
    const [enableScramblingDeviceLogin, setEnableScramblingDeviceLogin] =
        useState<boolean>(false);
    const form = useForm<z.infer<typeof loginFormSchema>>({
        resolver: zodResolver(loginFormSchema),
    });

    const onSubmit = (values: z.infer<typeof loginFormSchema>) => {
        handleLogin(values.username, values.password);
    };

    const handleScramblingDeviceLogin = async (code: string) => {
        const status = await getScramblingDeviceTokenFromCode(code);
        if (status === 201) {
            toast({
                title: "Successfully logged in.",
                description: "You have been successfully logged in.",
                variant: "success",
            });
            navigate("/scrambling-device");
        } else if (status === 404) {
            toast({
                title: "Error",
                description: "Wrong code",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
    };

    return (
        <>
            <div className="w-full flex flex-col gap-3">
                {enableScramblingDeviceLogin ? (
                    <>
                        <div className="flex flex-col items-center gap-3">
                            <Button
                                onClick={() =>
                                    setEnableScramblingDeviceLogin(false)
                                }
                                className="w-full"
                                disabled={isLoading}
                            >
                                Sign in
                            </Button>
                            <ScramblingDeviceForm
                                handleSubmit={handleScramblingDeviceLogin}
                                isLoading={isLoading}
                            />
                        </div>
                    </>
                ) : (
                    <>
                        {competition?.useFkmTimeDevices && (
                            <Button
                                className="mt-3"
                                disabled={isLoading}
                                onClick={() =>
                                    setEnableScramblingDeviceLogin(true)
                                }
                            >
                                Scrambling device
                            </Button>
                        )}
                        <Form {...form}>
                            <form
                                onSubmit={form.handleSubmit(onSubmit)}
                                className="space-y-8"
                            >
                                <FormField
                                    control={form.control}
                                    name="username"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Username</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Username"
                                                    disabled={isLoading}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Password</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="password"
                                                    disabled={isLoading}
                                                    placeholder="Password"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={isLoading}
                                    variant="success"
                                >
                                    Sign in
                                </Button>
                            </form>
                        </Form>
                        <Button
                            variant="secondary"
                            className="mt-3 flex items-center gap-3"
                            onClick={handleWcaLogin}
                            disabled={isLoading}
                        >
                            <img src={wca} alt="WCA" width="25" />
                            Sign in with WCA
                        </Button>
                    </>
                )}
            </div>
        </>
    );
};

export default LoginForm;
