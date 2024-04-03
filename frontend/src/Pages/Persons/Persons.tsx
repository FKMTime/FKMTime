import { Alert, AlertIcon, Box, Button, Input } from "@chakra-ui/react";
import { useAtom } from "jotai";
import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import PlusButton from "@/Components/PlusButton.tsx";
import { HAS_WRITE_ACCESS } from "@/logic/accounts";
import { competitionAtom } from "@/logic/atoms";
import { getUserInfo } from "@/logic/auth";
import { getCompetitionInfo } from "@/logic/competition";
import { Person } from "@/logic/interfaces";
import { getPersons } from "@/logic/persons";
import { calculateTotalPages } from "@/logic/utils";

import AddStaffMemberModal from "./Components/AddStaffMemberModal";
import PersonsTable from "./Components/PersonsTable";

const Persons = () => {
    const navigate = useNavigate();
    const userInfo = getUserInfo();
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [persons, setPersons] = useState<Person[]>([]);
    const [page, setPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(10);
    const [search, setSearch] = useState<string>("");
    const [searchedId, setSearchedId] = useState<string>("");
    const [personsWithoutCardAssigned, setPersonsWithoutCardAssigned] =
        useState<number>(0);
    const [isOpenAddStaffMemberModal, setIsOpenAddStaffMemberModal] =
        useState<boolean>(false);

    const fetchData = useCallback(
        async (
            pageParam = 1,
            pageSizeParam = 10,
            searchParam?: string,
            registrantId?: number
        ) => {
            const response = await getPersons(
                pageParam,
                pageSizeParam,
                searchParam,
                registrantId
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
        fetchData(1, pageSize, event.target.value);
    };

    const handleSearchId = (event: ChangeEvent<HTMLInputElement>) => {
        setSearchedId(event.target.value);
        fetchData(
            1,
            pageSize,
            undefined,
            event.target.value ? parseInt(event.target.value) : undefined
        );
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (!competition) {
        return <LoadingPage />;
    }

    return (
        <Box display="flex" flexDirection="column" gap="5">
            {HAS_WRITE_ACCESS.includes(userInfo.role) &&
                personsWithoutCardAssigned !== 0 && (
                    <>
                        <Alert
                            status="error"
                            color="black"
                            width={{ base: "100%", md: "40%" }}
                        >
                            <AlertIcon />
                            There are {personsWithoutCardAssigned} persons
                            without a card assigned. Please assign a card to
                            them.
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
                flexDirection="row"
                justifyContent={{ base: "center", md: "space-between" }}
                marginRight={{ base: "0", md: "5" }}
                gap={{ base: "3", md: "3" }}
            >
                <Box display="flex" gap="2">
                    <Input
                        placeholder="ID"
                        _placeholder={{ color: "white" }}
                        value={searchedId}
                        onChange={handleSearchId}
                        width={{ base: "auto", md: "20%" }}
                    />
                    <Input
                        placeholder="Search"
                        _placeholder={{ color: "white" }}
                        value={search}
                        onChange={handleSearch}
                        width="100%"
                    />
                </Box>
                {HAS_WRITE_ACCESS.includes(userInfo.role) && (
                    <PlusButton
                        aria-label="Add"
                        onClick={() => setIsOpenAddStaffMemberModal(true)}
                    />
                )}
            </Box>
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
            {isOpenAddStaffMemberModal && (
                <AddStaffMemberModal
                    isOpen={isOpenAddStaffMemberModal}
                    onClose={() => setIsOpenAddStaffMemberModal(false)}
                />
            )}
        </Box>
    );
};

export default Persons;
