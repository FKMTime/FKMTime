import { REGEXP_ONLY_DIGITS } from "input-otp";
import { ArrowLeft } from "lucide-react";
import { FormEvent, useState } from "react";

import InlineError from "@/Components/shared/InlineError";
import { Button } from "@/Components/ui/button";
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@/Components/ui/input-otp";

const CODE_LENGTH = 6;

interface DeviceCodeFormProps {
    error: string;
    isLoading: boolean;
    onSubmit: (code: string) => void;
    onChange: () => void;
    onBack: () => void;
}

const DeviceCodeForm = ({
    error,
    isLoading,
    onSubmit,
    onChange,
    onBack,
}: DeviceCodeFormProps) => {
    const [code, setCode] = useState("");
    const isComplete = code.length === CODE_LENGTH;

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        if (isComplete) onSubmit(code);
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <InputOTP
                maxLength={CODE_LENGTH}
                pattern={REGEXP_ONLY_DIGITS}
                inputMode="numeric"
                autoFocus
                aria-label="Device code"
                value={code}
                onChange={(value) => {
                    setCode(value);
                    onChange();
                }}
                // Sends the code as soon as the 6th digit is typed
                onComplete={(value: string) => {
                    if (!isLoading) onSubmit(value);
                }}
                disabled={isLoading}
                containerClassName="w-full"
            >
                <InputOTPGroup className="grid w-full grid-cols-6 gap-2">
                    {Array.from({ length: CODE_LENGTH }, (_, index) => (
                        <InputOTPSlot
                            key={index}
                            index={index}
                            invalid={!!error}
                        />
                    ))}
                </InputOTPGroup>
            </InputOTP>
            <InlineError>{error}</InlineError>
            <Button
                type="submit"
                disabled={!isComplete || isLoading}
                className="h-11 text-[15px] md:h-11"
            >
                Continue
            </Button>
            <Button type="button" variant="ghost" onClick={onBack}>
                <ArrowLeft />
                Back to staff sign in
            </Button>
        </form>
    );
};

export default DeviceCodeForm;
