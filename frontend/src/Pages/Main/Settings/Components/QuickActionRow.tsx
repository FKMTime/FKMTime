import { useState } from "react";

import DeleteButton from "@/Components/DeleteButton";
import EditButton from "@/Components/EditButton";
import { TableCell, TableRow } from "@/Components/ui/table";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { QuickAction } from "@/lib/interfaces";
import { deleteQuickAction } from "@/lib/quickActions";

import EditQuickActionModal from "./EditQuickActionModal";

interface QuickActionRowProps {
    quickAction: QuickAction;
    fetchData: () => void;
}

const QuickActionRow = ({ quickAction, fetchData }: QuickActionRowProps) => {
    const confirm = useConfirm();
    const { toast } = useToast();
    const [isOpenEditQuickActionModal, setIsOpenEditQuickActionModal] =
        useState(false);

    const handleDelete = async () => {
        confirm({
            title: "Delete quick action",
            description:
                "Are you sure you want to delete this quick action? This action cannot be undone",
        })
            .then(async () => {
                const status = await deleteQuickAction(quickAction.id);
                if (status === 204) {
                    toast({
                        title: "Successfully deleted quick action.",
                        variant: "success",
                    });
                    fetchData();
                } else {
                    toast({
                        title: "Error",
                        description: "Something went wrong",
                        variant: "destructive",
                    });
                }
            })
            .catch(() => {
                toast({
                    title: "Cancelled",
                    description:
                        "You have cancelled the deletion of the quick action.",
                });
            });
    };

    const handleCloseEditModal = () => {
        setIsOpenEditQuickActionModal(false);
        fetchData();
    };

    return (
        <TableRow>
            <TableCell>{quickAction.name}</TableCell>
            <TableCell>{quickAction.comment}</TableCell>
            <TableCell>{quickAction.giveExtra ? "Yes" : "No"}</TableCell>
            <TableCell>{quickAction.isShared ? "Yes" : "No"}</TableCell>
            <TableCell>{quickAction.user.fullName}</TableCell>
            <TableCell>
                <EditButton
                    onClick={() => setIsOpenEditQuickActionModal(true)}
                />
                <DeleteButton onClick={handleDelete} />
            </TableCell>
            <EditQuickActionModal
                isOpen={isOpenEditQuickActionModal}
                onClose={handleCloseEditModal}
                quickAction={quickAction}
            />
        </TableRow>
    );
};

export default QuickActionRow;
