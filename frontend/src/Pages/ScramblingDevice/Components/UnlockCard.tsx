import { Lock } from "lucide-react";
import { FormEvent, useState } from "react";

import InlineError from "@/Components/shared/InlineError";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { cn } from "@/lib/utils";

interface UnlockCardProps {
    setName: string;
    error: string;
    isUnlocking: boolean;
    onUnlock: (password: string) => void;
    onChange: () => void;
}

const UnlockCard = ({
    setName,
    error,
    isUnlocking,
    onUnlock,
    onChange,
}: UnlockCardProps) => {
    const [password, setPassword] = useState("");

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        onUnlock(password);
    };

    return (
        <div className="flex justify-center pt-10">
            <form
                onSubmit={handleSubmit}
                className="flex w-full max-w-[400px] flex-col gap-4 rounded-2xl border bg-card p-6"
            >
                <div className="flex items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                        <Lock className="size-[22px]" />
                    </span>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-base font-bold">{setName}</span>
                        <span className="text-[13px] text-muted-foreground">
                            Enter the password to unlock the scrambles
                        </span>
                    </div>
                </div>
                <Input
                    type="password"
                    value={password}
                    onChange={(event) => {
                        setPassword(event.target.value);
                        onChange();
                    }}
                    placeholder="Password"
                    aria-label="Password"
                    autoComplete="off"
                    autoFocus
                    aria-invalid={!!error}
                    className={cn(
                        "h-12 text-base md:h-12 md:text-base",
                        error && "border-destructive"
                    )}
                />
                <InlineError>{error}</InlineError>
                <Button
                    type="submit"
                    disabled={isUnlocking}
                    className="h-12 text-[15px] md:h-12"
                >
                    Unlock
                </Button>
            </form>
        </div>
    );
};

export default UnlockCard;
