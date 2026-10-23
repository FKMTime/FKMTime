import { ChangeEvent, KeyboardEvent, useState } from "react";

import { DNF_VALUE, DNS_VALUE, SKIPPED_VALUE } from "@/lib/constants";
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
    "aria-label"?: string;
    /** Called after Enter commits the typed time, e.g. to submit the form */
    onEnter?: () => void;
    /** Opts in to D for DNF and S for DNS; the typed time is kept */
    onPenaltyShortcut?: (penalty: number) => void;
}

const PENALTY_SHORTCUTS: Record<string, number> = {
    d: DNF_VALUE,
    s: DNS_VALUE,
};

const AttemptResultInput = ({
    value,
    onChange,
    disabled = false,
    placeholder,
    required,
    className,
    id,
    "aria-label": ariaLabel,
    onEnter,
    onPenaltyShortcut,
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
        const shortcut = PENALTY_SHORTCUTS[event.key.toLowerCase()];
        const hasModifier = event.ctrlKey || event.metaKey || event.altKey;
        if (shortcut !== undefined && onPenaltyShortcut && !hasModifier) {
            event.preventDefault();
            onPenaltyShortcut(shortcut);
            return;
        }
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
            aria-label={ariaLabel}
            placeholder={placeholder || "Time"}
            disabled={disabled}
            required={required}
            className={className}
            inputMode="numeric"
        />
    );
};

export default AttemptResultInput;
