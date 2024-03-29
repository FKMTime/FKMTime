import { FormControl, FormLabel } from "@chakra-ui/react";
import { ChangeEvent } from "react";

import { AVAILABLE_PENALTIES } from "@/logic/constants";

import Select from "./Select";

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
                value={value.toString()}
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
