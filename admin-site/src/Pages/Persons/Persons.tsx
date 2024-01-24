import { useEffect, useState } from "react";
import { Competition, Person } from "../../logic/interfaces";
import { Alert, AlertIcon, Box, Input } from "@chakra-ui/react";
import { getAllPersons } from "../../logic/persons";
import { calculateTotalPages } from "../../logic/utils";
import PersonsTable from "../../Components/Table/PersonsTable";
import { getCompetitionInfo } from "../../logic/competition";

const Persons = (): JSX.Element => {
    const [competition, setCompetition] = useState<Competition | undefined>();
    const [persons, setPersons] = useState<Person[]>([]);
    const [page, setPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(10);
    const [search, setSearch] = useState<string>("");

    const fetchData = async (page = 1, pageSize = 10, search?: string) => {
        const response = await getAllPersons(page, pageSize, search);
        const competitionResponse = await getCompetitionInfo();
        setCompetition(competitionResponse.data);
        setPersons(response.data);
        const totalPagesCalculation = calculateTotalPages(response.count, pageSize);
        setTotalPages(totalPagesCalculation);
    };

    const handlePageChange = (pageParam: number) => {
        setPage(pageParam);
        fetchData(pageParam);
    };

    const changePageSize = (pageSizeParam: number) => {
        setPageSize(pageSizeParam);
        fetchData(1, pageSizeParam);
    };

    const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
        fetchData(1, pageSize, event.target.value);
        setSearch(event.target.value);
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <Box display="flex" flexDirection="column" gap="5">
            <Alert status='info' color="black">
                <AlertIcon />
                Currently it is not possible to add a person during the competition. It is not recommended to have on the spot registration allowed.
            </Alert>
            <Input placeholder="Search" _placeholder={{ color: "white" }} value={search} onChange={handleSearch} />
            <PersonsTable persons={persons} competition={competition} fetchData={fetchData} changePageSize={changePageSize} handlePageChange={handlePageChange} page={page} totalPages={totalPages} pageSize={pageSize} />
        </Box>
    )
};

export default Persons;
