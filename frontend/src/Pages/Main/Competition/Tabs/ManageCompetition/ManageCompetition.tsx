import { AlertCircle, Wrench } from "lucide-react";

import { Alert, AlertTitle } from "@/Components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { useToast } from "@/hooks/useToast";
import { updateCompetitionSettings } from "@/lib/competition";
import { Competition } from "@/lib/interfaces";
import PageTransition from "@/Pages/PageTransition";

import CompetitionForm from "./Components/CompetitionForm";

interface ManageCompetitionProps {
    competition: Competition;
    setCompetition: (competition: Competition) => void;
}

const ManageCompetition = ({
    competition,
    setCompetition,
}: ManageCompetitionProps) => {
    const { toast } = useToast();

    const handleSubmit = async (data: Competition) => {
        if (!competition) {
            return;
        }
        setCompetition(data);
        const status = await updateCompetitionSettings(competition.id, data);
        if (status === 200) {
            toast({
                title: "Success",
                description: "Competition updated",
                variant: "success",
            });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
    };

    const emptyScoretakingToken =
        competition.scoretakingToken === "" || !competition.scoretakingToken;
    const scoretakingTokenMayExpired =
        competition.scoretakingTokenUpdatedAt &&
        new Date(competition.scoretakingTokenUpdatedAt).getTime() <
            new Date().getTime() - 7 * 24 * 60 * 60 * 1000;
    const anyWarnings = emptyScoretakingToken || scoretakingTokenMayExpired;

    return (
        <PageTransition>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Wrench size={20} />
                        Manage competition
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-5 md:w-1/3">
                        {anyWarnings && (
                            <div className="flex flex-col gap-5">
                                {emptyScoretakingToken && (
                                    <Alert variant="destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle>
                                            You need to set the scoretaking
                                            token taken from WCA Live before the
                                            competition
                                        </AlertTitle>
                                    </Alert>
                                )}
                                {scoretakingTokenMayExpired && (
                                    <Alert variant="destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle>
                                            The scoretaking token may have
                                            expired
                                        </AlertTitle>
                                    </Alert>
                                )}
                            </div>
                        )}
                        <CompetitionForm
                            competition={competition}
                            handleSubmit={handleSubmit}
                        />
                    </div>
                </CardContent>
            </Card>
        </PageTransition>
    );
};

export default ManageCompetition;
