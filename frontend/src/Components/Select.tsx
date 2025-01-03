import { ChangeEvent, ReactNode } from "react";

import {
    SelectContent,
    SelectLabel,
    SelectRoot,
    SelectTrigger,
    SelectValueText,
} from "@/Components/ui/select";

interface SelectProps {
    width?: string;
    onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
    value: string;
    disabled?: boolean;
    placeholder?: string;
    children: ReactNode;
}

const Select = ({
    width,
    value,
    onChange,
    disabled,
    children,
    placeholder,
}: SelectProps) => {
    return (
        <SelectRoot
            onValueChange={onChange}
            disabled={disabled}
            value={value}
            width={width}
            placeholder={placeholder}
        >
            <SelectLabel>{placeholder}</SelectLabel>
            <SelectTrigger>
                <SelectValueText placeholder="Select movie" />
            </SelectTrigger>
            <SelectContent>{children}</SelectContent>
        </SelectRoot>
    );
};

export default Select;
