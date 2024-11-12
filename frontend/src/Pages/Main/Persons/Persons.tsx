import { Box } from "@chakra-ui/react";
import { useAtom } from "jotai";
import { ChangeEvent, useCallback, useEffect, useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import Pagination from "@/Components/Pagination";
import { competitionAtom } from "@/logic/atoms";
import { getCompetitionInfo } from "@/logic/competition";
import { Person } from "@/logic/interfaces";
import { getPersons } from "@/logic/persons";
import { calculateTotalPages } from "@/logic/utils";

import AddPersonModal from "./Components/AddPersonModal";
import AssignCardsAlert from "./Components/AssignCardsAlert";
import PersonCard from "./Components/PersonCard";
import PersonsFilters from "./Components/PersonsFilters";
import PersonsTable from "./Components/PersonsTable";

const Persons = () => {
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
                <AssignCardsAlert
                    personsWithoutCardAssigned={personsWithoutCardAssigned}
                />
            )}
            <PersonsFilters
                searchedId={searchedId}
                handleSearchId={handleSearchId}
                searchedCardId={searchedCardId}
                handleSearchCardId={handleSearchCardId}
                search={search}
                handleSearch={handleSearch}
                onlyNewcomers={onlyNewcomers}
                handleOnlyNewcomers={handleOnlyNewcomers}
                onlyNotCheckedIn={onlyNotCheckedIn}
                handleOnlyNotCheckedIn={handleOnlyNotCheckedIn}
                setIsOpenAddPersonModal={setIsOpenAddPersonModal}
            />
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
