import { ChangeEvent } from "react";

import { AVAILABLE_PENALTIES } from "@/logic/constants";

import Select from "./Select";
import { Field } from "./ui/field";

interface PenaltySelectProps {
    value: number;
    onChange: (value: number) => void;
    disabled?: boolean;
    showLabel?: boolean;
    width?: string;
    shortVersion?: boolean;
}

const PenaltySelect = ({
    value,
    onChange,
    disabled = false,
    showLabel = true,
    shortVersion,
    width,
}: PenaltySelectProps) => {
    return (
        <Field label={showLabel ? "Penalty" : undefined} width={width}>
            <Select
                value={value.toString()}
                disabled={disabled}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    onChange(+event.target.value)
                }
            >
                {AVAILABLE_PENALTIES.map((penalty) => (
                    <option key={penalty.value} value={penalty.value}>
                        {shortVersion
                            ? penalty.shortVersion
                                ? penalty.shortVersion
                                : penalty.label
                            : penalty.label}
                    </option>
                ))}
            </Select>
        </Field>
    );
};

export default PenaltySelect;
