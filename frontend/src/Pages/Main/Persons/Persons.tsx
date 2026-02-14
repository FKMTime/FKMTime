/* eslint-disable react-hooks/set-state-in-effect, react-hooks/preserve-manual-memoization */
import { useAtom } from "jotai";
import { IdCard, Users } from "lucide-react";
import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import Pagination from "@/Components/Pagination";
import PlusButton from "@/Components/PlusButton";
import { Button } from "@/Components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/Components/ui/card";
import { competitionAtom } from "@/lib/atoms";
import { getCompetitionInfo } from "@/lib/competition";
import { Person } from "@/lib/interfaces";
import { isOrganizerOrDelegate } from "@/lib/permissions";
import { getPersons } from "@/lib/persons";
import { calculateTotalPages } from "@/lib/utils";
import PageTransition from "@/Pages/PageTransition";

import AddPersonModal from "./Components/AddPersonModal";
import PersonCard from "./Components/PersonCard";
import PersonsFilters from "./Components/PersonsFilters";
import PersonsTable from "./Components/PersonsTable";

const Persons = () => {
    const navigate = useNavigate();
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [persons, setPersons] = useState<Person[]>([]);
    const [totalPersonsCount, setTotalPersonsCount] = useState<number>(0);
    const [page, setPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(10);
    const [search, setSearch] = useState<string>("");
    const [searchedId, setSearchedId] = useState<string>("");
    const [searchedCardId, setSearchedCardId] = useState<string>("");
    const [personsWithCardAssigned, setPersonsWithCardAssigned] =
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
            setPersonsWithCardAssigned(response.personsWithCardAssigned);
            setTotalPersonsCount(response.count);
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

    const handlePageSizeChange = (newValue: string) => {
        changePageSize(parseInt(newValue));
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

    if (!competition || !persons) {
        return <LoadingPage />;
    }

    return (
        <PageTransition>
            <div className="flex flex-col gap-5">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex justify-between items-center">
                            <div className="flex gap-2 items-center">
                                <Users size={20} />
                                Persons
                            </div>
                            {isOrganizerOrDelegate() &&
                                competition.useFkmTimeDevices && (
                                    <>
                                        <PlusButton
                                            onClick={() =>
                                                setIsOpenAddPersonModal(true)
                                            }
                                        />
                                    </>
                                )}
                        </CardTitle>
                        {competition.useFkmTimeDevices && (
                            <CardDescription>
                                Assigned cards: {personsWithCardAssigned}/
                                {totalPersonsCount}
                            </CardDescription>
                        )}
                    </CardHeader>
                    <CardContent className="flex flex-col md:flex-row gap-5 md:justify-between">
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
                            totalPages={totalPages}
                            pageSize={pageSize}
                            handlePageSizeChange={handlePageSizeChange}
                            competition={competition}
                        />
                        {competition.useFkmTimeDevices && (
                            <Button
                                onClick={() => {
                                    navigate("/cards");
                                }}
                            >
                                <IdCard />
                                Assign cards
                            </Button>
                        )}
                    </CardContent>
                </Card>
                <Card className="hidden md:block py-3">
                    <CardHeader>
                        <CardTitle className="flex gap-2 items-center">
                            <Users size={20} />
                            Persons
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="w-full">
                        <PersonsTable
                            persons={persons}
                            competition={competition}
                            handleCloseEditModal={handleCloseEditModal}
                        />
                    </CardContent>
                </Card>
                <div className="flex md:hidden flex-col gap-3">
                    {persons.map((person) => (
                        <PersonCard
                            key={person.id}
                            wcif={competition.wcif}
                            person={person}
                            handleCloseEditModal={handleCloseEditModal}
                        />
                    ))}
                </div>
                {persons.length > 0 && totalPages > 1 && (
                    <Card>
                        <CardContent>
                            <Pagination
                                page={page}
                                totalPages={totalPages}
                                handlePageChange={handlePageChange}
                            />
                        </CardContent>
                    </Card>
                )}
                {isOpenAddPersonModal && (
                    <AddPersonModal
                        isOpen={isOpenAddPersonModal}
                        onClose={handleCloseAddPersonModal}
                    />
                )}
            </div>
        </PageTransition>
    );
};

export default Persons;
