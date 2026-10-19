import { AVAILABLE_PENALTIES } from "@/lib/constants";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";

interface PenaltySelectProps {
    value: number;
    onChange: (value: number) => void;
    disabled?: boolean;
    shortVersion?: boolean;
    className?: string;
    "aria-label"?: string;
}

const PenaltySelect = ({
    value,
    onChange,
    disabled = false,
    shortVersion,
    className,
    "aria-label": ariaLabel,
}: PenaltySelectProps) => {
    return (
        <Select
            onValueChange={(newValue) => onChange(+newValue)}
            value={value.toString()}
            disabled={disabled}
        >
            <SelectTrigger className={className} aria-label={ariaLabel}>
                <SelectValue placeholder="Select penalty" />
            </SelectTrigger>
            <SelectContent>
                {AVAILABLE_PENALTIES.map((penalty) => (
                    <SelectItem
                        key={penalty.value}
                        value={penalty.value.toString()}
                    >
                        {shortVersion
                            ? penalty.shortVersion
                                ? penalty.shortVersion
                                : penalty.label
                            : penalty.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};

export default PenaltySelect;
