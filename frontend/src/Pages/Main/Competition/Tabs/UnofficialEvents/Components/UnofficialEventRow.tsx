import { Td, Tr, useToast } from "@chakra-ui/react";
import { useConfirm } from "chakra-ui-confirm";
import { useState } from "react";

import DeleteButton from "@/Components/DeleteButton";
import EditButton from "@/Components/EditButton";
import { getEventName } from "@/logic/events";
import { UnofficialEvent } from "@/logic/interfaces";
import { deleteUnofficialEvent } from "@/logic/unofficialEvents";

import EditUnofficialEventModal from "./EditUnofficialEventModal";

interface UnofficialEventRowProps {
    event: UnofficialEvent;
    fetchData: () => void;
}

const UnofficialEventRow = ({ event, fetchData }: UnofficialEventRowProps) => {
    const confirm = useConfirm();
    const toast = useToast();
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
                        status: "success",
                    });
                    fetchData();
                } else if (status === 409) {
                    toast({
                        title: "Error",
                        description: "Cannot delete event with results",
                        status: "error",
                    });
                } else {
                    toast({
                        title: "Error",
                        description: "Something went wrong",
                        status: "error",
                    });
                }
            })
            .catch(() => {
                toast({
                    title: "Cancelled",
                    description:
                        "You have cancelled the deletion of the event.",
                    status: "info",
                });
            });
    };

    const handleCloseEditModal = () => {
        setIsOpenEditUnofficialEventModal(false);
        fetchData();
    };
    return (
        <>
            <Tr key={event.id}>
                <Td>{getEventName(event.eventId)}</Td>
                <Td>
                    <EditButton
                        onClick={() => setIsOpenEditUnofficialEventModal(true)}
                    />
                    <DeleteButton onClick={handleDelete} />
                </Td>
            </Tr>
            <EditUnofficialEventModal
                isOpen={isOpenEditUnofficialEventModal}
                onClose={handleCloseEditModal}
                unofficialEvent={event}
            />
        </>
    );
};

export default UnofficialEventRow;
