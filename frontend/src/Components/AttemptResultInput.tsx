import { ChangeEvent, KeyboardEvent, useState } from "react";

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
    disabled?: boolean;
    placeholder?: string;
    required?: boolean;
    className?: string;
    id?: string;
    /** Called after Enter commits the typed time, e.g. to submit the form */
    onEnter?: () => void;
}

const AttemptResultInput = ({
    value,
    onChange,
    disabled = false,
    placeholder,
    required,
    className,
    id,
    onEnter,
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

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== "Enter" || !onEnter) return;
        // The time is only committed on blur; commit it before submitting
        event.preventDefault();
        handleBlur();
        setTimeout(onEnter);
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
            onKeyDown={handleKeyDown}
            id={id}
            placeholder={placeholder || "Time"}
            disabled={disabled}
            required={required}
            className={className}
            inputMode="numeric"
        />
    );
};

export default AttemptResultInput;
