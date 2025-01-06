import { Button, Td, Tr, useToast } from "@chakra-ui/react";
import { useConfirm } from "chakra-ui-confirm";

import { activityCodeToName } from "@/lib/activities";
import { ScrambleSet } from "@/lib/interfaces";
import { deleteScrambleSet } from "@/lib/scrambleSets";

interface ScrambleSetRowProps {
    scrambleSet: ScrambleSet;
    fetchData: () => void;
}

const ScrambleSetRow = ({ scrambleSet, fetchData }: ScrambleSetRowProps) => {
    const toast = useToast();
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
                    status: "info",
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
            <TableCell display="flex" gap="2">
                <Button colorScheme="red" onClick={handleDelete}>
                    Delete
                </Button>
            </TableCell>
        </TableRow>
    );
};

export default ScrambleSetRow;
