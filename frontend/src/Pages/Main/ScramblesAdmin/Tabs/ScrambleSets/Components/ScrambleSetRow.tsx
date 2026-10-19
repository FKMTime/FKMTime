import { Trash2 } from "lucide-react";

import RowActions from "@/Components/shared/RowActions";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
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

    const name = `Set ${scrambleSet.set}`;

    return (
        <li className="flex items-center gap-3 border-b py-2 pl-3.5 pr-1 last:border-b-0 md:py-2.5 md:pl-5 md:pr-3">
            <div className="flex min-w-0 flex-1 flex-col md:flex-row md:items-center md:gap-6">
                <span className="text-[15px] font-semibold md:w-24 md:text-sm">
                    {name}
                </span>
                <span className="text-[13px] text-muted-foreground md:text-sm">
                    {scrambleSet.scramblesCount} scrambles ·{" "}
                    {scrambleSet.extraScramblesCount} extra
                </span>
            </div>
            <RowActions
                subject={name}
                items={[
                    {
                        label: "Delete scramble set",
                        icon: Trash2,
                        destructive: true,
                        onSelect: handleDelete,
                    },
                ]}
            />
        </li>
    );
};

export default ScrambleSetRow;
