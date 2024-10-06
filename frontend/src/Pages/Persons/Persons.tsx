import {
    Alert,
    AlertIcon,
    Box,
    Button,
    FormControl,
    FormLabel,
    Input,
    Switch,
} from "@chakra-ui/react";
import { useAtom } from "jotai";
import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import Pagination from "@/Components/Pagination";
import PlusButton from "@/Components/PlusButton.tsx";
import { competitionAtom } from "@/logic/atoms";
import { isAdmin } from "@/logic/auth";
import { getCompetitionInfo } from "@/logic/competition";
import { Person } from "@/logic/interfaces";
import { getPersons } from "@/logic/persons";
import { calculateTotalPages } from "@/logic/utils";

import AddPersonModal from "./Components/AddPersonModal";
import PersonCard from "./Components/PersonCard";
import PersonsTable from "./Components/PersonsTable";

const Persons = () => {
    const navigate = useNavigate();
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [persons, setPersons] = useState<Person[]>([]);
    const [page, setPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(10);
    const [search, setSearch] = useState<string>("");
    const [searchedId, setSearchedId] = useState<string>("");
    const [searchedCardId, setSearchedCardId] = useState<string>("");
    const [personsWithoutCardAssigned, setPersonsWithoutCardAssigned] =
        useState<number>(0);
    const [onlyNewcomers, setOnlyNewcomers] = useState<boolean>(false);
    const [onlyNotCheckedIn, setOnlyNotCheckedIn] = useState<boolean>(false);
    const [isOpenAddPersonModal, setIsOpenAddPersonModal] =
        useState<boolean>(false);

    const fetchData = useCallback(
        async (
            pageParam = 1,
            pageSizeParam = 10,
            searchParam?: string,
            registrantId?: number,
            cardId?: string,
            onlyNewcomersParam?: boolean,
            onlyNotCheckedInParam?: boolean
        ) => {
            const response = await getPersons(
                pageParam,
                pageSizeParam,
                searchParam,
                registrantId,
                undefined,
                cardId,
                onlyNewcomersParam,
                onlyNotCheckedInParam
            );
            if (!competition) {
                const competitionData = await getCompetitionInfo();
                setCompetition(competitionData.data);
            }
            setPersons(response.data);
            setPersonsWithoutCardAssigned(response.personsWithoutCardAssigned);
            const totalPagesCalculation = calculateTotalPages(
                response.count,
                pageSizeParam
            );
            setTotalPages(totalPagesCalculation);
        },
        [competition, setCompetition]
    );

    const handlePageChange = (pageParam: number) => {
        setPage(pageParam);
        fetchData(pageParam, pageSize, search);
    };

    const handleCloseEditModal = async () => {
        await fetchData(
            page,
            pageSize,
            search,
            searchedId ? parseInt(searchedId) : undefined
        );
    };

    const changePageSize = (pageSizeParam: number) => {
        setPageSize(pageSizeParam);
        fetchData(1, pageSizeParam, search);
    };

    const handleSearch = (event: ChangeEvent<HTMLInputElement>) => {
        setSearch(event.target.value);
        setSearchedId("");
        setSearchedCardId("");
        fetchData(1, pageSize, event.target.value);
    };

    const handleSearchId = (event: ChangeEvent<HTMLInputElement>) => {
        setSearchedId(event.target.value);
        setSearchedCardId("");
        setSearch("");
        fetchData(
            1,
            pageSize,
            undefined,
            event.target.value ? parseInt(event.target.value) : undefined
        );
    };

    const handleSearchCardId = (event: ChangeEvent<HTMLInputElement>) => {
        setSearchedCardId(event.target.value);
        setSearch("");
        setSearchedId("");
        fetchData(1, pageSize, undefined, undefined, event.target.value);
    };

    const handleOnlyNewcomers = () => {
        setOnlyNewcomers(!onlyNewcomers);
        fetchData(
            1,
            pageSize,
            search,
            undefined,
            searchedCardId,
            !onlyNewcomers
        );
    };

    const handleOnlyNotCheckedIn = () => {
        setOnlyNotCheckedIn(!onlyNotCheckedIn);
        fetchData(
            1,
            pageSize,
            search,
            undefined,
            searchedCardId,
            onlyNewcomers,
            !onlyNotCheckedIn
        );
    };

    const handleCloseAddPersonModal = () => {
        fetchData(
            page,
            pageSize,
            search,
            searchedId ? parseInt(searchedId) : undefined,
            searchedCardId
        );
        setIsOpenAddPersonModal(false);
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (!competition) {
        return <LoadingPage />;
    }

    return (
        <Box display="flex" flexDirection="column" gap="5">
            {personsWithoutCardAssigned !== 0 && (
                <>
                    <Alert
                        status="error"
                        color="black"
                        width={{ base: "100%", md: "40%" }}
                    >
                        <AlertIcon />
                        There are {personsWithoutCardAssigned} persons without a
                        card assigned. Please assign a card to them.
                    </Alert>
                    <Button
                        onClick={() => {
                            navigate("/cards");
                        }}
                        colorScheme="yellow"
                        width={{ base: "100%", md: "20%" }}
                    >
                        Assign cards
                    </Button>
                </>
            )}
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
                                colorScheme="blue"
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
            <Box display={{ base: "none", md: "block" }}>
                <PersonsTable
                    persons={persons}
                    competition={competition}
                    handleCloseEditModal={handleCloseEditModal}
                    changePageSize={changePageSize}
                    handlePageChange={handlePageChange}
                    page={page}
                    totalPages={totalPages}
                    pageSize={pageSize}
                />
            </Box>
            <Box
                display={{ base: "flex", md: "none" }}
                flexDirection="column"
                gap={3}
            >
                {persons.map((person) => (
                    <PersonCard
                        key={person.id}
                        wcif={competition.wcif}
                        person={person}
                        handleCloseEditModal={handleCloseEditModal}
                    />
                ))}
                <Pagination
                    page={page}
                    totalPages={totalPages}
                    handlePageChange={handlePageChange}
                    changePageSize={changePageSize}
                    pageSize={pageSize}
                />
            </Box>
            {isOpenAddPersonModal && (
                <AddPersonModal
                    isOpen={isOpenAddPersonModal}
                    onClose={handleCloseAddPersonModal}
                />
            )}
        </Box>
    );
};

export default Persons;
