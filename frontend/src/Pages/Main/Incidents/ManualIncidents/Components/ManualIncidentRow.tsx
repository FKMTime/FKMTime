import { useState } from "react";

import DeleteButton from "@/Components/DeleteButton";
import EditButton from "@/Components/EditButton";
import { TableCell, TableRow } from "@/Components/ui/table";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import { deleteManualIncident } from "@/lib/incidents";
import { ManualIncident } from "@/lib/interfaces";

import EditManualIncidentModal from "./EditManualIncidentModal";

interface ManualIncidentRowProps {
    incident: ManualIncident;
    fetchData: () => void;
}

const ManualIncidentRow = ({ incident, fetchData }: ManualIncidentRowProps) => {
    const { toast } = useToast();
    const confirm = useConfirm();
    const [isOpenEditIncidentModal, setIsOpenEditIncidentModal] =
        useState<boolean>(false);

    const handleDelete = async () => {
        confirm({
            title: "Delete incident",
            description: "Are you sure you want to delete this incident?",
        })
            .then(async () => {
                const status = await deleteManualIncident(incident.id);
                if (status === 204) {
                    toast({
                        title: "Successfully deleted incident.",
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
                        "You have cancelled the deletion of this incident.",
                });
            });
    };

    const handleCloseEditModal = () => {
        fetchData();
        setIsOpenEditIncidentModal(false);
    };

    return (
        <TableRow>
            <TableCell>{incident.person.name}</TableCell>
            <TableCell>{activityCodeToName(incident.roundId, true)}</TableCell>
            <TableCell>{incident.attempt}</TableCell>
            <TableCell>{incident.description}</TableCell>
            <TableCell>{incident.createdBy?.fullName}</TableCell>
            <TableCell>
                <EditButton onClick={() => setIsOpenEditIncidentModal(true)} />
                <DeleteButton onClick={handleDelete} />
            </TableCell>
            <EditManualIncidentModal
                incident={incident}
                isOpen={isOpenEditIncidentModal}
                onClose={handleCloseEditModal}
            />
        </TableRow>
    );
};

export default ManualIncidentRow;
