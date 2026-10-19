import { useSetAtom } from "jotai";
import { RefreshCw, Server, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import { Alert, AlertTitle } from "@/Components/ui/alert";
import { Button } from "@/Components/ui/button";
import { useToast } from "@/hooks/useToast";
import { competitionAtom } from "@/lib/atoms";
import {
    getCompetitionInfo,
    getCompetitionSettings,
    syncCompetition,
    updateCompetitionSettings,
} from "@/lib/competition";
import { Competition as CompetitionInterface } from "@/lib/interfaces";
import { getGitCommitValue } from "@/lib/utils";
import SetupTabs from "@/Pages/Main/Setup/SetupTabs";

import CompetitionForm from "./Components/CompetitionForm";

const TOKEN_MAY_EXPIRE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

const Competition = () => {
    const { toast } = useToast();
    const navigate = useNavigate();
    const location = useLocation();
    const setCompetitionAtom = useSetAtom(competitionAtom);
    const initialCompetition: CompetitionInterface | null =
        location.state?.importedCompetition ?? null;
    const [isLoading, setIsLoading] = useState<boolean>(!initialCompetition);
    const [isSyncing, setIsSyncing] = useState(false);
    const [competition, setCompetition] = useState<CompetitionInterface | null>(
        initialCompetition
    );

    const fetchData = useCallback(async () => {
        const response = await getCompetitionSettings();
        if (response.status === 200) {
            setCompetition(response.data);
        } else if (response.status === 404) {
            navigate("/competition/import");
        }
        setIsLoading(false);
    }, [navigate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSync = async () => {
        if (!competition?.wcaId) return;
        setIsSyncing(true);
        const status = await syncCompetition(competition.wcaId);
        setIsSyncing(false);
        if (status === 200) {
            toast({
                title: "Success",
                description: "Competition synced",
                variant: "success",
            });
            const response = await getCompetitionInfo();
            setCompetitionAtom(response.data);
        } else if (status === 403) {
            toast({
                title: "Error",
                description:
                    "You don't have permission to sync this competition",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
    };

    const handleSubmit = async (data: CompetitionInterface) => {
        if (!competition) return;
        setCompetition(data);
        const status = await updateCompetitionSettings(competition.id, data);
        if (status === 200) {
            setCompetitionAtom(data);
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

    if (isLoading || !competition) return <LoadingPage />;

    const isTokenEmpty = !competition.scoretakingToken;
    const mayTokenHaveExpired =
        !!competition.scoretakingTokenUpdatedAt &&
        new Date(competition.scoretakingTokenUpdatedAt).getTime() <
            Date.now() - TOKEN_MAY_EXPIRE_AFTER_MS;

    return (
        <>
            <SetupTabs value="competition" />
            <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-bold">
                        {competition.name}
                    </h2>
                    <p className="text-[13px] text-muted-foreground">
                        Version {getGitCommitValue()}
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSync}
                    disabled={isSyncing}
                >
                    <RefreshCw className={isSyncing ? "animate-spin" : ""} />
                    Sync with WCA
                </Button>
                {import.meta.env.PROD && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open("/logs")}
                    >
                        <Server />
                        Logs
                    </Button>
                )}
            </div>
            {competition.useFkmTimeDevices &&
                (isTokenEmpty || mayTokenHaveExpired) && (
                    <Alert variant="warning">
                        <TriangleAlert />
                        <AlertTitle>
                            {isTokenEmpty
                                ? "Set the scoretaking token from WCA Live before the competition"
                                : "The scoretaking token may have expired"}
                        </AlertTitle>
                    </Alert>
                )}
            <div className="rounded-mobile-card border bg-card p-4 md:rounded-2xl md:p-6">
                <CompetitionForm
                    competition={competition}
                    handleSubmit={handleSubmit}
                />
            </div>
        </>
    );
};

export default Competition;
