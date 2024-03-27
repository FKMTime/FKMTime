import { DarkMode, Select as ChakraSelect } from "@chakra-ui/react";

interface SelectProps {
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    value: string;
    disabled?: boolean;
    placeholder?: string;
    children: React.ReactNode;
}

const Select: React.FC<SelectProps> = ({
    value,
    onChange,
    disabled,
    children,
    placeholder,
}) => {
    return (
        <DarkMode>
            <ChakraSelect
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
