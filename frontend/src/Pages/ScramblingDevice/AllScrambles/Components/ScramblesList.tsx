import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { DecryptedScramble } from "@/lib/interfaces";

interface ScramblesListProps {
    scrambles: DecryptedScramble[];
    roundId: string;
}

const ScramblesList = ({ scrambles, roundId }: ScramblesListProps) => {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Scramble</TableHead>
                    <TableHead>Image</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {scrambles.map((scramble) => (
                    <TableRow>
                        <TableCell>
                            {`${scramble.isExtra ? "E" : ""}${scramble.num}`}
                        </TableCell>
                        <TableCell>
                            <pre className="text-wrap max-w-[60%] text-2xl">
                                {scramble.scramble}
                            </pre>
                        </TableCell>
                        <TableCell>
                            <scramble-display
                                scramble={scramble?.scramble}
                                event={roundId.split("-")[0]}
                            ></scramble-display>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};

export default ScramblesList;
