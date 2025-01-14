import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { ScrambleSet } from "@/lib/interfaces";

import ScrambleSetRow from "./ScrambleSetRow";

interface ScrambleSetsTableProps {
    scrambleSets: ScrambleSet[];
    fetchData: (roundId?: string) => void;
}

const ScrambleSetsTable = ({
    scrambleSets,
    fetchData,
}: ScrambleSetsTableProps) => {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Scrambles</TableHead>
                    <TableHead>Extra scrambles</TableHead>
                    <TableHead>Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {scrambleSets.map((set) => (
                    <ScrambleSetRow
                        key={set.id}
                        scrambleSet={set}
                        fetchData={fetchData}
                    />
                ))}
            </TableBody>
        </Table>
    );
};

export default ScrambleSetsTable;
