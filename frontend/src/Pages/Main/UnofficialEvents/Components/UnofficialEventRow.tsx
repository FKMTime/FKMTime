import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import RowActions from "@/Components/shared/RowActions";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { getEventIconClass, getEventName } from "@/lib/events";
import { UnofficialEvent } from "@/lib/interfaces";
import { deleteUnofficialEvent } from "@/lib/unofficialEvents";
import { cn } from "@/lib/utils";

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
                // Declined: closing the dialog is feedback enough
            });
    };

    const handleCloseEditModal = () => {
        setIsOpenEditUnofficialEventModal(false);
        fetchData();
    };
    const roundCount = event.wcif.rounds.length;
    const name = getEventName(event.eventId) ?? event.eventId;

    return (
        <li className="flex items-center gap-3 border-b py-2 pl-3.5 pr-1 last:border-b-0 md:gap-3.5 md:py-3 md:pl-5 md:pr-3">
            <span
                aria-hidden
                className={cn(
                    "cubing-icon text-[22px]",
                    getEventIconClass(event.eventId)
                )}
            />
            <div className="flex min-w-0 flex-1 flex-col md:flex-row md:items-center md:gap-3.5">
                <span className="truncate text-[15px] font-semibold md:flex-1">
                    {name}
                </span>
                <span className="text-[13px] text-muted-foreground">
                    {roundCount === 1 ? "1 round" : `${roundCount} rounds`}
                </span>
            </div>
            <RowActions
                subject={name}
                primary={{
                    label: "Edit rounds",
                    icon: Pencil,
                    onSelect: () => setIsOpenEditUnofficialEventModal(true),
                }}
                items={[
                    {
                        label: "Delete event",
                        icon: Trash2,
                        destructive: true,
                        onSelect: handleDelete,
                    },
                ]}
            />
            <EditUnofficialEventModal
                isOpen={isOpenEditUnofficialEventModal}
                onClose={handleCloseEditModal}
                unofficialEvent={event}
            />
        </li>
    );
};

export default UnofficialEventRow;
