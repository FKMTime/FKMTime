import { Table } from "@chakra-ui/react";
import { useConfirm } from "chakra-ui-confirm";
import { useState } from "react";

import DeleteButton from "@/Components/DeleteButton";
import EditButton from "@/Components/EditButton";
import { toaster } from "@/Components/ui/toaster";
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
                    toaster.create({
                        title: "Successfully deleted event.",
                        type: "success",
                    });
                    fetchData();
                } else if (status === 409) {
                    toaster.create({
                        title: "Error",
                        description: "Cannot delete event with results",
                        type: "error",
                    });
                } else {
                    toaster.create({
                        title: "Error",
                        description: "Something went wrong",
                        type: "error",
                    });
                }
            })
            .catch(() => {
                toaster.create({
                    title: "Cancelled",
                    description:
                        "You have cancelled the deletion of the event.",
                    type: "info",
                });
            });
    };

    const handleCloseEditModal = () => {
        setIsOpenEditUnofficialEventModal(false);
        fetchData();
    };
    return (
        <>
            <Table.Row key={event.id}>
                <Table.Cell>{getEventName(event.eventId)}</Table.Cell>
                <Table.Cell>
                    <EditButton
                        onClick={() => setIsOpenEditUnofficialEventModal(true)}
                    />
                    <DeleteButton onClick={handleDelete} />
                </Table.Cell>
            </Table.Row>
            <EditUnofficialEventModal
                isOpen={isOpenEditUnofficialEventModal}
                onClose={handleCloseEditModal}
                unofficialEvent={event}
            />
        </>
    );
};

export default UnofficialEventRow;
