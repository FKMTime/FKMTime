import { Table, TableContainer, Tbody, Th, Thead, Tr } from "@chakra-ui/react";
import { Station } from "../../logic/interfaces";
import StationRow from "./Row/StationRow";

interface StationsTableProps {
    stations: Station[];
    fetchData: () => void;
}

const StationsTable: React.FC<StationsTableProps> = ({
    stations,
    fetchData,
}): JSX.Element => {
    return (
        <TableContainer>
            <Table variant="simple">
                <Thead>
                    <Tr bg="gray.400">
                        <Th>ID</Th>
                        <Th>Name</Th>
                        <Th>ESP ID</Th>
                        <Th>Actions</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {stations.map((station) => (
                        <StationRow
                            key={station.id}
                            station={station}
                            fetchData={fetchData}
                        />
                    ))}
                </Tbody>
            </Table>
        </TableContainer>
    );
};

export default StationsTable;
