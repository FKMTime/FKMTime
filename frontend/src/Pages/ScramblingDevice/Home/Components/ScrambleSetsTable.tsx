import { useNavigate } from "react-router-dom";

import { Button } from "@/Components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { activityCodeToName } from "@/lib/activities";
import { ScrambleSet } from "@/lib/interfaces";

interface ScrambleSetsTableProps {
    scrambleSets: ScrambleSet[];
    showScrambleButton: boolean;
}

const ScrambleSetsTable = ({
    scrambleSets,
    showScrambleButton,
}: ScrambleSetsTableProps) => {
    const navigate = useNavigate();
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {scrambleSets.map((scrambleSet) => (
                    <TableRow key={scrambleSet.id}>
                        <TableCell>
                            {activityCodeToName(scrambleSet.roundId)} Set{" "}
                            {scrambleSet.set}
                        </TableCell>
                        <TableCell className="flex gap-2">
                            {showScrambleButton ? (
                                <Button
                                    onClick={() =>
                                        navigate(
                                            `/scrambling-device/set/${scrambleSet.id}`
                                        )
                                    }
                                >
                                    Scramble
                                </Button>
                            ) : null}
                            <Button
                                onClick={() =>
                                    navigate(
                                        `/scrambling-device/set/${scrambleSet.id}/scrambles`
                                    )
                                }
                                variant="success"
                            >
                                All scrambles
                            </Button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};

export default ScrambleSetsTable;
