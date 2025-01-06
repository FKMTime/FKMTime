import { Box, Input, List, ListItem, useToast } from "@chakra-ui/react";
import React, { useEffect, useRef, useState } from "react";

import useEscape from "@/hooks/useEscape";

type DynamicAutocompleteProps<T> = {
    fetchOptions: (query: string) => Promise<T[]>;
    onChange: (selectedOption: T | null) => void;
    getOptionLabel: (option: T) => string;
    placeholder?: string;
    disabled?: boolean;
    autoFocus?: boolean;
};

const DynamicAutocomplete = <T,>({
    fetchOptions,
    onChange,
    getOptionLabel,
    placeholder = "Search...",
    disabled,
    autoFocus,
}: DynamicAutocompleteProps<T>) => {
    const toast = useToast();
    const [query, setQuery] = useState<string>("");
    const [filteredOptions, setFilteredOptions] = useState<T[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState<number | null>(
        null
    );
    const [isLoading, setIsLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEscape(() => setIsOpen(false));

    const handleInputChange = async (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const value = e.target.value;
        setQuery(value);

        if (!value) {
            setFilteredOptions([]);
            setIsOpen(false);
            return;
        }

        setIsLoading(true);
        try {
            const options = await fetchOptions(value);
            setFilteredOptions(options);
            setIsOpen(true);
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to fetch options",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleOptionClick = (option: T) => {
        setQuery(getOptionLabel(option));
        setIsOpen(false);
        setHighlightedIndex(null);
        onChange(option);
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
        if (!query) {
            onChange(null);
        }
    }, [query, onChange]);

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
                    <List>
                        {isLoading ? (
                            <ListItem p={2} textAlign="center" color="gray.500">
                                Loading...
                            </ListItem>
                        ) : filteredOptions.length > 0 ? (
                            filteredOptions.map((option, index) => (
                                <ListItem
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
                                </ListItem>
                            ))
                        ) : (
                            <ListItem p={2} textAlign="center" color="gray.500">
                                No options found
                            </ListItem>
                        )}
                    </List>
                </Box>
            )}
        </Box>
    );
};

export default DynamicAutocomplete;
