import { Button, Td, Tr, useToast } from "@chakra-ui/react";
import { useConfirm } from "chakra-ui-confirm";

import { activityCodeToName } from "@/logic/activities";
import { ScrambleSet } from "@/logic/interfaces";
import { deleteScrambleSet } from "@/logic/scrambleSets";

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
                        status: "success",
                    });
                    fetchData();
                } else {
                    toast({
                        title: "Something went wrong",
                        status: "error",
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
        <Tr>
            <Td>
                {activityCodeToName(scrambleSet.roundId)} Set {scrambleSet.set}
            </Td>
            <Td>{scrambleSet.scramblesCount}</Td>
            <Td>{scrambleSet.extraScramblesCount}</Td>
            <Td display="flex" gap="2">
                <Button colorPalette="red" onClick={handleDelete}>
                    Delete
                </Button>
            </Td>
        </Tr>
    );
};

export default ScrambleSetRow;
