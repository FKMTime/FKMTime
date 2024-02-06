import { useCallback, useEffect, useState } from "react";
import { Competition, Person } from "../../logic/interfaces";
import { Alert, AlertIcon, Box, Button, Input } from "@chakra-ui/react";
import { getAllPersons } from "../../logic/persons";
import { calculateTotalPages } from "../../logic/utils";
import PersonsTable from "../../Components/Table/PersonsTable";
import { getCompetitionInfo } from "../../logic/competition";
import { useNavigate } from "react-router-dom";

const Persons = (): JSX.Element => {
    const navigate = useNavigate();
    const [competition, setCompetition] = useState<Competition | undefined>();
    const [persons, setPersons] = useState<Person[]>([]);
    const [page, setPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(10);
    const [search, setSearch] = useState<string>("");
    const [personsWithoutCardAssigned, setPersonsWithoutCardAssigned] = useState<number>(0);

    const fetchData = useCallback(async (pageParam = 1, pageSizeParam = 10, searchParam?: string) => {
        const response = await getAllPersons(pageParam, pageSizeParam, searchParam);
        const competitionResponse = await getCompetitionInfo();
        setCompetition(competitionResponse.data);
        setPersons(response.data);
        setPersonsWithoutCardAssigned(response.personsWithoutCardAssigned);
        const totalPagesCalculation = calculateTotalPages(response.count, pageSizeParam);
        setTotalPages(totalPagesCalculation);
    }, []);

    const handlePageChange = (pageParam: number) => {
        setPage(pageParam);
        fetchData(pageParam);
    };

    const handleCloseEditModal = async () => {
        await fetchData(page, pageSize, search);
    };

    const changePageSize = (pageSizeParam: number) => {
        setPageSize(pageSizeParam);
        fetchData(1, pageSizeParam);
    };

    const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(event.target.value);
        fetchData(1, pageSize, event.target.value);
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <Box display="flex" flexDirection="column" gap="5">
            <Alert status='info' color="black">
                <AlertIcon />
                Currently it is not possible to add a person during the competition. It is not recommended to have on the spot registration allowed.
            </Alert>
            {personsWithoutCardAssigned !== 0 && (
                <>
                    <Alert status='error' color="black">
                        <AlertIcon />
                        There are {personsWithoutCardAssigned} persons without a card assigned. Please assign a card to them.
                    </Alert>
                    <Button onClick={() => {
                        navigate("/cards");
                    }}
                    colorScheme="yellow"
                    width="20%"
                    >Assign cards</Button>
                </>
            )}
            <Input placeholder="Search" _placeholder={{ color: "white" }} value={search} onChange={handleSearch} />
            <PersonsTable persons={persons} competition={competition} handleCloseEditModal={handleCloseEditModal} changePageSize={changePageSize} handlePageChange={handlePageChange} page={page} totalPages={totalPages} pageSize={pageSize} />
        </Box>
    )
};

export default Persons;
