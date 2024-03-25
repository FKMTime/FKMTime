import { FormControl, FormLabel, Select } from "@chakra-ui/react";
import { AVAILABLE_PENALTIES } from "../logic/constants.ts";
import { ChangeEvent } from "react";

interface PenaltySelectProps {
    value: number;
    onChange: (value: number) => void;
    disabled?: boolean;
}

const PenaltySelect = ({
    value,
    onChange,
    disabled = false,
}: PenaltySelectProps) => {
    return (
        <FormControl>
            <FormLabel>Penalty</FormLabel>
            <Select
                placeholder="Select penalty"
                _placeholder={{ color: "white" }}
                value={value}
                disabled={disabled}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    onChange(+event.target.value)
                }
            >
                {AVAILABLE_PENALTIES.map((penalty) => (
                    <option key={penalty.value} value={penalty.value}>
                        {penalty.label}
                    </option>
                ))}
            </Select>
        </FormControl>
    );
};

export default PenaltySelect;
