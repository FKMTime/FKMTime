import {
    Alert,
    AlertIcon,
    Box,
    Button,
    IconButton,
    Input,
} from "@chakra-ui/react";
import { useAtom } from "jotai";
import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { MdAdd } from "react-icons/md";
import { useNavigate } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
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
    const [personsWithoutCardAssigned, setPersonsWithoutCardAssigned] =
        useState<number>(0);
    const [isOpenAddStaffMemberModal, setIsOpenAddStaffMemberModal] =
        useState<boolean>(false);

    const fetchData = useCallback(
        async (pageParam = 1, pageSizeParam = 10, searchParam?: string) => {
            const response = await getPersons(
                pageParam,
                pageSizeParam,
                searchParam
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
        await fetchData(page, pageSize, search);
    };

    const changePageSize = (pageSizeParam: number) => {
        setPageSize(pageSizeParam);
        fetchData(1, pageSizeParam, search);
    };

    const handleSearch = (event: ChangeEvent<HTMLInputElement>) => {
        setSearch(event.target.value);
        fetchData(1, pageSize, event.target.value);
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
                justifyContent="space-between"
                marginRight="5"
                gap="5"
            >
                <Input
                    placeholder="Search"
                    _placeholder={{ color: "white" }}
                    value={search}
                    onChange={handleSearch}
                    width={{ base: "100%", md: "40%" }}
                />
                {HAS_WRITE_ACCESS.includes(userInfo.role) && (
                    <IconButton
                        icon={<MdAdd />}
                        aria-label="Add"
                        bg="white"
                        color="black"
                        rounded="20"
                        width="5"
                        height="10"
                        _hover={{
                            background: "white",
                            color: "gray.700",
                        }}
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
