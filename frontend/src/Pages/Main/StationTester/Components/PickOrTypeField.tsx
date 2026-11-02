import { useId } from "react";

import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";

interface PickOrTypeFieldProps {
    label: string;
    options: { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    inputType?: "text" | "number";
    required?: boolean;
}

/** A list of what's in the database, next to a box for any other value */
const PickOrTypeField = ({
    label,
    options,
    value,
    onChange,
    placeholder,
    inputType = "text",
    required,
}: PickOrTypeFieldProps) => {
    const id = useId();
    const isOption = options.some((option) => option.value === value);

    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={id}>{label}</Label>
            <div className="grid grid-cols-[2fr_1fr] gap-2">
                <Select value={isOption ? value : ""} onValueChange={onChange}>
                    <SelectTrigger aria-label={`${label} list`}>
                        <SelectValue placeholder={placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                        {options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Input
                    id={id}
                    type={inputType}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    required={required}
                />
            </div>
        </div>
    );
};

export default PickOrTypeField;
