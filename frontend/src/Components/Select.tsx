import { DarkMode, Select as ChakraSelect } from "@chakra-ui/react";
import { ChangeEvent, ReactNode } from "react";

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
        <DarkMode>
            <ChakraSelect
                width={width}
                value={value}
                onChange={onChange}
                disabled={disabled}
                borderColor="white"
                _hover={{
                    borderColor: "white",
                }}
                placeholder={placeholder}
            >
                {children}
            </ChakraSelect>
        </DarkMode>
    );
};

export default Select;
