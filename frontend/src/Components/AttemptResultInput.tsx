import { ChangeEvent, useState } from "react";

import { SKIPPED_VALUE } from "@/lib/constants";
import {
    attemptResultToInput,
    autocompleteTimeAttemptResult,
    inputToAttemptResult,
    isValid,
    reformatInput,
} from "@/lib/resultFormatters";

import { Input } from "./ui/input";

interface AttemptResultInputProps {
    value: number;
    onChange: (value: number) => void;
    disabled: boolean;
    placeholder?: string;
    required?: boolean;
}

const AttemptResultInput = ({
    value,
    onChange,
    disabled,
    placeholder,
    required,
}: AttemptResultInputProps) => {
    const [prevValue, setPrevValue] = useState<number>(value);
    const [draftInput, setDraftInput] = useState<string>(
        attemptResultToInput(value)
    );

    if (prevValue !== value) {
        setDraftInput(attemptResultToInput(value));
        setPrevValue(value);
    }

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        setDraftInput(reformatInput(event.target.value));
    };

    const handleBlur = () => {
        const attempt = isValid(draftInput)
            ? autocompleteTimeAttemptResult(inputToAttemptResult(draftInput))
            : SKIPPED_VALUE;
        onChange(attempt);
        setDraftInput(attemptResultToInput(value));
    };

    return (
        <Input
            value={draftInput}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={placeholder || "Time"}
            disabled={disabled}
            required={required}
        />
    );
};

export default AttemptResultInput;
