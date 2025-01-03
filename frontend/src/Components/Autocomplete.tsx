import { Box, Input, List } from "@chakra-ui/react";
import React, { useEffect, useRef, useState } from "react";

import useEscape from "@/hooks/useEscape";

type AutocompleteProps<T> = {
    options: T[];
    selectedValue?: T | null;
    onOptionSelect: (option: T) => void;
    getOptionLabel: (option: T) => string;
    placeholder?: string;
    disabled?: boolean;
    autoFocus?: boolean;
};

const Autocomplete = <T,>({
    options,
    selectedValue,
    onOptionSelect,
    getOptionLabel,
    placeholder = "Search...",
    disabled,
    autoFocus,
}: AutocompleteProps<T>) => {
    const [query, setQuery] = useState<string>(
        selectedValue ? getOptionLabel(selectedValue) : ""
    );
    const [filteredOptions, setFilteredOptions] = useState<T[]>(options);
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState<number | null>(
        null
    );
    const inputRef = useRef<HTMLInputElement>(null);

    useEscape(() => setIsOpen(false));

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);
        setFilteredOptions(
            value
                ? options.filter((option) =>
                      getOptionLabel(option)
                          .toLowerCase()
                          .includes(value.toLowerCase())
                  )
                : options
        );
        setIsOpen(!!value);
        setHighlightedIndex(null);
    };

    const handleOptionClick = (option: T) => {
        setQuery(getOptionLabel(option));
        setIsOpen(false);
        setHighlightedIndex(null);
        onOptionSelect(option);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightedIndex((prev) =>
                prev === null || prev === filteredOptions.length - 1
                    ? 0
                    : prev + 1
            );
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedIndex((prev) =>
                prev === null || prev === 0
                    ? filteredOptions.length - 1
                    : prev - 1
            );
        } else if (e.key === "Enter" && highlightedIndex !== null) {
            e.preventDefault();
            handleOptionClick(filteredOptions[highlightedIndex]);
        } else if (e.key === "Escape") {
            setIsOpen(false);
        }
    };

    useEffect(() => {
        if (selectedValue === null) {
            setQuery("");
        } else if (selectedValue) {
            setQuery(getOptionLabel(selectedValue));
        }
    }, [selectedValue, getOptionLabel]);

    return (
        <Box position="relative" w="300px">
            <Input
                ref={inputRef}
                placeholder={placeholder}
                value={query}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsOpen(true)}
                bg="gray.700"
                borderColor="white"
                color="white"
                disabled={disabled}
                autoFocus={autoFocus}
                borderRadius="md"
                _placeholder={{ color: "gray.400" }}
                _focus={{ borderColor: "blue.500" }}
            />
            {isOpen && (
                <Box
                    position="absolute"
                    bg="gray.800"
                    border="1px solid"
                    borderColor="gray.600"
                    borderRadius="md"
                    boxShadow="lg"
                    mt={1}
                    zIndex={1}
                    w="100%"
                    maxH="200px"
                    overflowY="auto"
                >
                    <List.Root>
                        {filteredOptions.map((option, index) => (
                            <List.Item
                                key={index}
                                p={2}
                                cursor="pointer"
                                color="white"
                                bg={
                                    highlightedIndex === index
                                        ? "gray.600"
                                        : "transparent"
                                }
                                _hover={{ bg: "gray.600" }}
                                onClick={() => handleOptionClick(option)}
                            >
                                {getOptionLabel(option)}
                            </List.Item>
                        ))}
                        {filteredOptions.length === 0 && (
                            <List.Item
                                p={2}
                                textAlign="center"
                                color="gray.500"
                            >
                                No options found
                            </List.Item>
                        )}
                    </List.Root>
                </Box>
            )}
        </Box>
    );
};

export default Autocomplete;
