import { useState } from "react";

import DeleteButton from "@/Components/DeleteButton";
import EditButton from "@/Components/EditButton";
import { TableCell, TableRow } from "@/Components/ui/table";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { getEventName } from "@/lib/events";
import { UnofficialEvent } from "@/lib/interfaces";
import { deleteUnofficialEvent } from "@/lib/unofficialEvents";

import EditUnofficialEventModal from "./EditUnofficialEventModal";

interface UnofficialEventRowProps {
    event: UnofficialEvent;
    fetchData: () => void;
}

const UnofficialEventRow = ({ event, fetchData }: UnofficialEventRowProps) => {
    const confirm = useConfirm();
    const { toast } = useToast();
    const [isOpenEditUnofficialEventModal, setIsOpenEditUnofficialEventModal] =
        useState<boolean>(false);

    const handleDelete = () => {
        confirm({
            title: "Delete unofficial event",
            description: `Are you sure you want to delete ${getEventName(event.eventId)}? This action cannot be undone`,
        })
            .then(async () => {
                const status = await deleteUnofficialEvent(event.id);
                if (status === 204) {
                    toast({
                        title: "Successfully deleted event.",
                    });
                    fetchData();
                } else if (status === 409) {
                    toast({
                        title: "Error",
                        description: "Cannot delete event with results",
                        variant: "destructive",
                    });
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
                        "You have cancelled the deletion of the event.",
                });
            });
    };

    const handleCloseEditModal = () => {
        setIsOpenEditUnofficialEventModal(false);
        fetchData();
    };
    return (
        <>
            <TableRow key={event.id}>
                <TableCell>{getEventName(event.eventId)}</TableCell>
                <TableCell>
                    <EditButton
                        onClick={() => setIsOpenEditUnofficialEventModal(true)}
                    />
                    <DeleteButton onClick={handleDelete} />
                </TableCell>
            </TableRow>
            <EditUnofficialEventModal
                isOpen={isOpenEditUnofficialEventModal}
                onClose={handleCloseEditModal}
                unofficialEvent={event}
            />
        </>
    );
};

export default UnofficialEventRow;
