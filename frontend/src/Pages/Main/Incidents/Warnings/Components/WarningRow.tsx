import DeleteButton from "@/Components/DeleteButton";
import { TableCell, TableRow } from "@/Components/ui/table";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { Warning } from "@/lib/interfaces";
import { deleteWarning } from "@/lib/warnings";

interface WarningRowProps {
    warning: Warning;
    fetchData: (searchParam?: string) => void;
}

const WarningRow = ({ warning, fetchData }: WarningRowProps) => {
    const confirm = useConfirm();
    const { toast } = useToast();

    const handleDelete = () => {
        confirm({
            title: "Are you sure you want to delete this warning?",
        }).then(async () => {
            const status = await deleteWarning(warning.id);
            if (status === 204) {
                toast({
                    title: "Warning deleted",
                    variant: "success",
                });
                fetchData();
            } else {
                toast({
                    title: "Something went wrong",
                    variant: "destructive",
                });
            }
        });
    };

    return (
        <TableRow>
            <TableCell>{warning.person.name}</TableCell>
            <TableCell>{warning.description}</TableCell>
            <TableCell>{warning.createdBy?.fullName}</TableCell>
            <TableCell>
                <DeleteButton onClick={handleDelete} />
            </TableCell>
        </TableRow>
    );
};

export default WarningRow;
