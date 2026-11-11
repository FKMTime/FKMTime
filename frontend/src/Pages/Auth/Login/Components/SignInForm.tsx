import { Shuffle } from "lucide-react";
import { FormEvent, useState } from "react";

import wca from "@/assets/wca.svg";
import InlineError from "@/Components/shared/InlineError";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { cn } from "@/lib/utils";

interface SignInFormProps {
    error: string;
    isLoading: boolean;
    showScramblingDevice: boolean;
    onSubmit: (username: string, password: string) => void;
    onChange: () => void;
    onWcaLogin: () => void;
    onScramblingDevice: () => void;
}

const fieldLabelClassName =
    "flex flex-col gap-1.5 text-[13px] font-semibold text-muted-foreground";
const fieldClassName =
    "h-11 text-[15px] font-normal text-foreground md:h-11 md:text-[15px]";
const largeButtonClassName = "h-11 text-[15px] md:h-11";

const SignInForm = ({
    error,
    isLoading,
    showScramblingDevice,
    onSubmit,
    onChange,
    onWcaLogin,
    onScramblingDevice,
}: SignInFormProps) => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        onSubmit(username, password);
    };

    const inputClassName = cn(
        fieldClassName,
        error && "border-destructive focus-visible:border-destructive"
    );

    return (
        <>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                <label className={fieldLabelClassName}>
                    Username
                    <Input
                        value={username}
                        onChange={(event) => {
                            setUsername(event.target.value);
                            onChange();
                        }}
                        placeholder="Username"
                        autoComplete="username"
                        required
                        disabled={isLoading}
                        aria-invalid={!!error}
                        className={inputClassName}
                    />
                </label>
                <label className={fieldLabelClassName}>
                    Password
                    <Input
                        type="password"
                        value={password}
                        onChange={(event) => {
                            setPassword(event.target.value);
                            onChange();
                        }}
                        placeholder="Password"
                        autoComplete="current-password"
                        required
                        disabled={isLoading}
                        aria-invalid={!!error}
                        className={inputClassName}
                    />
                </label>
                <InlineError>{error}</InlineError>
                <Button
                    type="submit"
                    disabled={isLoading}
                    className={cn(largeButtonClassName, "mt-1")}
                >
                    Sign in
                </Button>
            </form>
            <div className="flex items-center gap-3 text-xs text-faint">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
            </div>
            <div className="flex flex-col gap-2">
                <Button
                    variant="outline"
                    onClick={onWcaLogin}
                    disabled={isLoading}
                    className={cn(largeButtonClassName, "gap-2.5")}
                >
                    <img src={wca} alt="" width={22} height={22} />
                    Sign in with WCA
                </Button>
                {showScramblingDevice && (
                    <Button
                        variant="outline"
                        onClick={onScramblingDevice}
                        disabled={isLoading}
                        className={cn(
                            largeButtonClassName,
                            "gap-2.5 border-border [&_svg]:size-5 [&_svg]:text-muted-foreground"
                        )}
                    >
                        <Shuffle />
                        Scrambling device
                    </Button>
                )}
            </div>
        </>
    );
};

export default SignInForm;
