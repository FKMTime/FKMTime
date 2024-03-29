import { Input } from "@chakra-ui/react";
import { ChangeEvent, useState } from "react";

import { SKIPPED_VALUE } from "@/logic/constants";
import {
    attemptResultToInput,
    autocompleteTimeAttemptResult,
    inputToAttemptResult,
    isValid,
    reformatInput,
} from "@/logic/resultFormatters";

interface AttemptResultInputProps {
    value: number;
    onChange: (value: number) => void;
    disabled: boolean;
}

const AttemptResultInput = ({
    value,
    onChange,
    disabled,
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
            placeholder="Time"
            _placeholder={{ color: "white" }}
            disabled={disabled}
        />
    );
};

export default AttemptResultInput;
