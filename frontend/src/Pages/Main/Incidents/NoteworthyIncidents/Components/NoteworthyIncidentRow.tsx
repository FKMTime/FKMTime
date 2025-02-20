import { useState } from "react";
import { Link } from "react-router-dom";

import DeleteButton from "@/Components/DeleteButton";
import EditButton from "@/Components/EditButton";
import { TableCell, TableRow } from "@/Components/ui/table";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { deleteNoteworthyIncident } from "@/lib/incidents";
import { NoteworthyIncident } from "@/lib/interfaces";

import EditNoteworthyIncidentModal from "./EditNoteworthyIncidentModal";

interface NoteworthyIncidentRowProps {
    incident: NoteworthyIncident;
    fetchData: () => void;
}

const NoteworthyIncidentRow = ({
    incident,
    fetchData,
}: NoteworthyIncidentRowProps) => {
    const { toast } = useToast();
    const confirm = useConfirm();
    const [isOpenEditIncidentModal, setIsOpenEditIncidentModal] =
        useState<boolean>(false);

    const handleDelete = async () => {
        confirm({
            title: "Delete incident",
            description:
                "Are you sure you want to delete this noteworthy incident? This won't delete the attempt (if any) associated with this incident.",
        })
            .then(async () => {
                const status = await deleteNoteworthyIncident(incident.id);
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
            <TableCell>{incident.title}</TableCell>
            <TableCell>{incident.description}</TableCell>
            <TableCell>
                {incident.attempt && (
                    <Link
                        to={`/results/${incident.attempt.resultId}`}
                        className="text-blue-500 hover:underline"
                    >
                        See all results
                    </Link>
                )}
            </TableCell>
            <TableCell>{incident.createdBy?.fullName}</TableCell>
            <TableCell>
                <EditButton onClick={() => setIsOpenEditIncidentModal(true)} />
                <DeleteButton onClick={handleDelete} />
            </TableCell>
            <EditNoteworthyIncidentModal
                incident={incident}
                isOpen={isOpenEditIncidentModal}
                onClose={handleCloseEditModal}
            />
        </TableRow>
    );
};

export default NoteworthyIncidentRow;
