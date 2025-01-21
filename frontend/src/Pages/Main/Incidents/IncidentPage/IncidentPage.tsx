import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getLimitByRoundId } from "wcif-helpers";

import LoadingPage from "@/Components/LoadingPage";
import QuickActions from "@/Components/QuickActions";
import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { competitionAtom, unresolvedIncidentsCountAtom } from "@/lib/atoms";
import { deleteAttempt, getIncidentById, updateAttempt } from "@/lib/attempt";
import { getUnresolvedIncidentsCount } from "@/lib/incidents";
import {
    ApplicationQuickAction,
    AttemptStatus,
    Incident,
} from "@/lib/interfaces";
import { milisecondsToClockFormat } from "@/lib/resultFormatters";
import PageTransition from "@/Pages/PageTransition";

import IncidentForm from "./Components/IncidentForm";
import IncidentWarnings from "./Components/IncidentWarnings";

const IncidentPage = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const confirm = useConfirm();
    const { id } = useParams<{ id: string }>();
    const competition = useAtomValue(competitionAtom);

    const [editedIncident, setEditedIncident] = useState<Incident | null>(null);
    const [previousIncidents, setPreviousIncidents] = useState<Incident[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const setUnresolvedIncidentsCount = useSetAtom(
        unresolvedIncidentsCountAtom
    );

    const timeLimit = useMemo(() => {
        if (!competition || !editedIncident) {
            return null;
        }
        return getLimitByRoundId(
            editedIncident.result.roundId,
            competition.wcif
        );
    }, [competition, editedIncident]);

    useEffect(() => {
        if (!id) return;
        getIncidentById(id).then((data) => {
            setEditedIncident(data.attempt);
            setPreviousIncidents(data.previousIncidents);
        });
    }, [id]);

    const fetchUnresolvedIncidentsCount = useCallback(() => {
        getUnresolvedIncidentsCount().then((data) =>
            setUnresolvedIncidentsCount(data.count)
        );
    }, [setUnresolvedIncidentsCount]);

    const handleQuickAction = (action: ApplicationQuickAction) => {
        if (!editedIncident) return;
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
                variant: "destructive",
            });
        }
        setIsLoading(true);
        const status = await updateAttempt(data);
        if (status === 200) {
            fetchUnresolvedIncidentsCount();
            toast({
                title: "Incident updated",
                variant: "success",
            });
            navigate("/incidents");
        } else {
            toast({
                title: "Error",
                description: "An error occurred while updating the incident",
                variant: "destructive",
            });
        }
        setIsLoading(false);
    };

    const handleDelete = async () => {
        if (!editedIncident) return;
        confirm({
            title: "Are you sure you want to delete this attempt?",
            description: "This action cannot be undone.",
            onConfirm: async () => {
                setIsLoading(true);
                const response = await deleteAttempt(editedIncident.id);
                if (response.status === 200) {
                    toast({
                        title: "Successfully deleted attempt.",
                        variant: "success",
                    });
                    navigate("/incidents");
                } else {
                    toast({
                        title: "Error",
                        description: "Something went wrong",
                        variant: "destructive",
                    });
                }
                setIsLoading(false);
            },
        });
    };

    if (!editedIncident) {
        return <LoadingPage />;
    }

    return (
        <PageTransition>
            <div className="flex flex-col gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>
                            {editedIncident.result.person.name} (
                            {editedIncident.result.person.wcaId
                                ? editedIncident.result.person.wcaId
                                : "Newcomer"}
                            )
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <Button
                            className="w-fit"
                            onClick={() =>
                                navigate(
                                    `/results/${editedIncident?.result.id}`
                                )
                            }
                        >
                            All attempts from this average
                        </Button>
                        <IncidentWarnings
                            previousIncidents={previousIncidents}
                        />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Quick actions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:flex gap-4">
                            <QuickActions
                                handleQuickAction={handleQuickAction}
                            />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Edit incident</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {editedIncident.inspectionTime ? (
                            <p>
                                Inspection time:{" "}
                                {milisecondsToClockFormat(
                                    editedIncident.inspectionTime
                                )}
                            </p>
                        ) : null}
                        <IncidentForm
                            editedIncident={editedIncident}
                            handleSubmit={handleSubmit}
                            isLoading={isLoading}
                            timeLimit={timeLimit ? timeLimit : undefined}
                            handleDelete={handleDelete}
                        />
                    </CardContent>
                </Card>
            </div>
        </PageTransition>
    );
};

export default IncidentPage;
