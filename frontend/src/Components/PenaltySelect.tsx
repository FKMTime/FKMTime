import { FormControl, FormLabel } from "@chakra-ui/react";
import { ChangeEvent } from "react";

import { AVAILABLE_PENALTIES } from "@/lib/constants";

import Select from "./Select";

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
        <FormControl width={width}>
            {showLabel && <FormLabel>Penalty</FormLabel>}
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
        </FormControl>
    );
};

export default PenaltySelect;
