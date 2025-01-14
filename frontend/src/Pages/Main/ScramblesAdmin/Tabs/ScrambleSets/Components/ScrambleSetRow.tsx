import DeleteButton from "@/Components/DeleteButton";
import { TableCell, TableRow } from "@/Components/ui/table";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import { ScrambleSet } from "@/lib/interfaces";
import { deleteScrambleSet } from "@/lib/scrambleSets";

interface ScrambleSetRowProps {
    scrambleSet: ScrambleSet;
    fetchData: () => void;
}

const ScrambleSetRow = ({ scrambleSet, fetchData }: ScrambleSetRowProps) => {
    const { toast } = useToast();
    const confirm = useConfirm();

    const handleDelete = async () => {
        confirm({
            title: "Are you sure you want to delete this scramble set?",
            description: "This action cannot be undone.",
        })
            .then(async () => {
                const status = await deleteScrambleSet(scrambleSet.id);
                if (status === 204) {
                    toast({
                        title: "Scramble set deleted",
                        variant: "success",
                    });
                    fetchData();
                } else {
                    toast({
                        title: "Something went wrong",
                        variant: "destructive",
                    });
                }
            })
            .catch(() => {
                toast({
                    title: "Scramble set not deleted",
                });
            });
    };

    return (
        <TableRow>
            <TableCell>
                {activityCodeToName(scrambleSet.roundId)} Set {scrambleSet.set}
            </TableCell>
            <TableCell>{scrambleSet.scramblesCount}</TableCell>
            <TableCell>{scrambleSet.extraScramblesCount}</TableCell>
            <TableCell>
                <DeleteButton
                    onClick={handleDelete}
                    title="Delete scramble set"
                />
            </TableCell>
        </TableRow>
    );
};

export default ScrambleSetRow;
