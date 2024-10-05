import { Box, Button, Text, useToast } from "@chakra-ui/react";
import { useConfirm } from "chakra-ui-confirm";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import { deleteAttempt, getIncidentById, updateAttempt } from "@/logic/attempt";
import {
    ApplicationQuickAction,
    AttemptStatus,
    Incident,
} from "@/logic/interfaces";

import IncidentForm from "./Components/IncidentForm";
import IncidentWarnings from "./Components/IncidentWarnings";
import QuickActions from "./Components/QuickActions";

const IncidentPage = () => {
    const navigate = useNavigate();
    const toast = useToast();
    const confirm = useConfirm();
    const { id } = useParams<{ id: string }>();

    const [editedIncident, setEditedIncident] = useState<Incident | null>(null);
    const [previousIncidents, setPreviousIncidents] = useState<Incident[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    useEffect(() => {
        if (!id) return;
        getIncidentById(id).then((data) => {
            setEditedIncident(data.attempt);
            setPreviousIncidents(data.previousIncidents);
        });
    }, [id]);

    if (!editedIncident) {
        return <LoadingPage />;
    }

    const handleQuickAction = (action: ApplicationQuickAction) => {
        const data = {
            ...editedIncident,
            status: action.giveExtra
                ? AttemptStatus.EXTRA_GIVEN
                : AttemptStatus.RESOLVED,
            comment: action.comment || "",
            updateReplacedBy: false,
        };
        setEditedIncident(data);
        handleSubmit(data);
    };

    const handleSubmit = async (data: Incident) => {
        if (
            data.value === 0 &&
            data.penalty === 0 &&
            data.status !== AttemptStatus.EXTRA_GIVEN
        ) {
            return toast({
                title: "Error",
                description:
                    "The time must be greater than 0 or DNF penalty should be applied",
                status: "error",
            });
        }
        setIsLoading(true);
        const status = await updateAttempt(data);
        if (status === 200) {
            toast({
                title: "Incident updated",
                status: "success",
            });
            navigate("/incidents");
        } else {
            toast({
                title: "Error",
                description: "An error occurred while updating the incident",
                status: "error",
            });
        }
        setIsLoading(false);
    };

    const handleDelete = async () => {
        confirm({
            title: "Are you sure you want to delete this attempt?",
            description: "This action cannot be undone.",
            onConfirm: async () => {
                setIsLoading(true);
                const response = await deleteAttempt(editedIncident.id);
                if (response.status === 200) {
                    toast({
                        title: "Successfully deleted attempt.",
                        status: "success",
                    });
                    navigate("/incidents");
                } else {
                    toast({
                        title: "Error",
                        description: "Something went wrong",
                        status: "error",
                    });
                }
                setIsLoading(false);
            },
        });
    };

    return (
        <Box
            display="flex"
            flexDirection="column"
            gap="5"
            width={{ base: "100%", md: "fit-content" }}
            minWidth="20%"
        >
            <Button
                colorScheme="yellow"
                onClick={() =>
                    navigate(`/results/${editedIncident?.result.id}`)
                }
            >
                All attempts from this average
            </Button>
            <QuickActions handleQuickAction={handleQuickAction} />
            <Text>
                Competitor: {editedIncident.result.person.name} (
                {editedIncident.result.person.wcaId
                    ? editedIncident.result.person.wcaId
                    : "Newcomer"}
                )
            </Text>
            <IncidentWarnings previousIncidents={previousIncidents} />
            <IncidentForm
                editedIncident={editedIncident}
                setEditedIncident={setEditedIncident}
                isLoading={isLoading}
                handleSubmit={handleSubmit}
                handleDelete={handleDelete}
            />
        </Box>
    );
};

export default IncidentPage;
