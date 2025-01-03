import {
    Box,
    Button,
    FormControl,
    FormLabel,
    Input,
    Switch,
} from "@chakra-ui/react";

import PlusButton from "@/Components/PlusButton";
import { isAdmin } from "@/logic/auth";

interface PersonsFiltersProps {
    searchedId: string;
    handleSearchId: (e: React.ChangeEvent<HTMLInputElement>) => void;
    searchedCardId: string;
    handleSearchCardId: (e: React.ChangeEvent<HTMLInputElement>) => void;
    search: string;
    handleSearch: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onlyNewcomers: boolean;
    handleOnlyNewcomers: () => void;
    onlyNotCheckedIn: boolean;
    handleOnlyNotCheckedIn: () => void;
    setIsOpenAddPersonModal: (value: boolean) => void;
}

const PersonsFilters = ({
    searchedId,
    handleSearchId,
    searchedCardId,
    handleSearchCardId,
    search,
    handleSearch,
    onlyNewcomers,
    handleOnlyNewcomers,
    onlyNotCheckedIn,
    handleOnlyNotCheckedIn,
    setIsOpenAddPersonModal,
}: PersonsFiltersProps) => {
    return (
        <>
            <Box
                display="flex"
                flexDirection={{ base: "column", md: "row" }}
                justifyContent={{ base: "center", md: "space-between" }}
                marginRight={{ base: "0", md: "5" }}
            >
                <Box
                    display="flex"
                    gap="2"
                    flexDirection={{ base: "column", md: "row" }}
                >
                    <Input
                        placeholder="ID"
                        _placeholder={{ color: "white" }}
                        value={searchedId}
                        onChange={handleSearchId}
                        width={{ base: "auto", md: "20%" }}
                    />
                    <Input
                        placeholder="Card"
                        _placeholder={{ color: "white" }}
                        value={searchedCardId}
                        onChange={handleSearchCardId}
                        width={{ base: "auto", md: "30%" }}
                    />
                    <Input
                        placeholder="Search"
                        _placeholder={{ color: "white" }}
                        value={search}
                        onChange={handleSearch}
                        width="100%"
                    />
                </Box>
                {isAdmin() && (
                    <>
                        <Box display={{ base: "none", md: "flex" }} gap="2">
                            <PlusButton
                                aria-label="Add"
                                onClick={() => setIsOpenAddPersonModal(true)}
                            />
                        </Box>
                        <Box display={{ base: "flex", md: "none" }} mt={2}>
                            <Button
                                onClick={() => setIsOpenAddPersonModal(true)}
                                colorPalette="blue"
                                width="100%"
                            >
                                Add person
                            </Button>
                        </Box>
                    </>
                )}
            </Box>
            <Box display="flex" gap="2" flexDirection="column">
                <FormControl display="flex" alignItems="center" gap="2">
                    <Switch
                        id="onlyNewcomers"
                        onChange={handleOnlyNewcomers}
                        isChecked={onlyNewcomers}
                    />
                    <FormLabel htmlFor="onlyNewcomers" mb="0">
                        Newcomers
                    </FormLabel>
                </FormControl>
                <FormControl display="flex" alignItems="center" gap="2">
                    <Switch
                        id="onlyNotCheckedIn"
                        onChange={handleOnlyNotCheckedIn}
                        isChecked={onlyNotCheckedIn}
                    />
                    <FormLabel htmlFor="onlyNotCheckedIn" mb="0">
                        Not checked in
                    </FormLabel>
                </FormControl>
            </Box>
        </>
    );
};

export default PersonsFilters;
