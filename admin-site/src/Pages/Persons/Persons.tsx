import { useEffect, useState } from "react";
import { Person } from "../../logic/interfaces";
import { Box } from "@chakra-ui/react";
import { getAllPersons } from "../../logic/persons";
import { calculateTotalPages } from "../../logic/utils";
import PersonsTable from "../../Components/Table/PersonsTable";

const Persons = (): JSX.Element => {
    const [persons, setPersons] = useState<Person[]>([]);
    const [page, setPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(10);

    const fetchData = async (page = 1, pageSize = 10) => {
        const response = await getAllPersons(page, pageSize);
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

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <Box display="flex" flexDirection="column" gap="5">
            <PersonsTable persons={persons} fetchData={fetchData} changePageSize={changePageSize} handlePageChange={handlePageChange} page={page} totalPages={totalPages} pageSize={pageSize} />
        </Box>
    )
};

export default Persons;
