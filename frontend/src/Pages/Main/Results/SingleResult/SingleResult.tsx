/* eslint-disable react-hooks/set-state-in-effect, react-hooks/preserve-manual-memoization */
import { useAtom } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getLimitByRoundId, getNumberOfAttemptsForRound } from "wcif-helpers";

import LoadingPage from "@/Components/LoadingPage";
import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import { useToast } from "@/hooks/useToast";
import { competitionAtom } from "@/lib/atoms";
import { getCompetitionInfo } from "@/lib/competition";
import { Result } from "@/lib/interfaces";
import { getResultById } from "@/lib/results";
import { getSubmittedAttempts } from "@/lib/utils";
import PageTransition from "@/Pages/PageTransition";

import CreateAttemptModal from "../Components/CreateAttemptModal";
import AttemptsTable from "./Components/AttemptsTable";
import SingleResultHeaderCard from "./Components/SingleResultHeaderCard";
import SwapAttemptsModal from "./Components/SwapAttemptsModal";
import WarningsAndLimitsCard from "./Components/WarningsAndLimitsCard";

const SingleResult = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [competition, setCompetition] = useAtom(competitionAtom);
    const [result, setResult] = useState<Result | null>(null);
    const [isOpenCreateAttemptModal, setIsOpenCreateAttemptModal] =
        useState<boolean>(false);
    const [isOpenSwapAttemptsModal, setIsOpenSwapAttemptsModal] =
        useState<boolean>(false);
    const standardAttempts = useMemo(() => {
        if (!result) return [];
        return (
            result.attempts
                .filter((attempt) => attempt.type === "STANDARD_ATTEMPT")
                .sort((a, b) => a.attemptNumber - b.attemptNumber) || []
        );
    }, [result]);
    const extraAttempts = useMemo(() => {
        if (!result) return [];
        return (
            result.attempts
                .filter((attempt) => attempt.type === "EXTRA_ATTEMPT")
                .sort((a, b) => a.attemptNumber - b.attemptNumber) || []
        );
    }, [result]);
    const submittedAttempts = useMemo(() => {
        if (!result) return [];
        return getSubmittedAttempts(result.attempts);
    }, [result]);

    const limit = useMemo(() => {
        if (!competition || !result) {
            return null;
        }
        return getLimitByRoundId(result.roundId, competition.wcif);
    }, [competition, result]);

    const maxAttempts = useMemo(() => {
        if (!competition || !result) {
            return 0;
        }
        return getNumberOfAttemptsForRound(result.roundId, competition.wcif);
    }, [competition, result]);

    const fetchData = useCallback(async () => {
        if (!id) return;
        if (!competition) {
            const competitionData = await getCompetitionInfo();
            setCompetition(competitionData.data);
        }
        const response = await getResultById(id);
        if (response.status === 404) {
            toast({
                title: "Error",
                description: "Result not found",
                variant: "destructive",
            });
            navigate("/results");
        }
        setResult(response.data);
    }, [competition, id, navigate, setCompetition, toast]);

    const handleCloseModal = () => {
        fetchData();
        setIsOpenCreateAttemptModal(false);
        setIsOpenSwapAttemptsModal(false);
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (!result || !competition) return <LoadingPage />;

    return (
        <PageTransition>
            <div className="flex flex-col gap-4">
                <SingleResultHeaderCard
                    result={result}
                    fetchData={fetchData}
                    setIsOpenCreateAttemptModal={setIsOpenCreateAttemptModal}
                    standardAttempts={standardAttempts}
                    maxAttempts={maxAttempts}
                />
                <WarningsAndLimitsCard
                    competition={competition}
                    result={result}
                    submittedAttempts={submittedAttempts}
                    limit={limit}
                    maxAttempts={maxAttempts}
                />
                <Tabs defaultValue="submitted">
                    <Card>
                        <CardHeader>
                            <CardTitle>Results</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <TabsList>
                                <TabsTrigger value="submitted">
                                    Submitted to WCA Live
                                </TabsTrigger>
                                <TabsTrigger value="standard">
                                    Standard
                                </TabsTrigger>
                                {extraAttempts.length > 0 && (
                                    <TabsTrigger value="extra">
                                        Extra
                                    </TabsTrigger>
                                )}
                            </TabsList>
                        </CardContent>
                    </Card>
                    <TabsContent value="submitted">
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    Attempts submitted to WCA Live
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {submittedAttempts.length === 0 ? (
                                    <p>No attempts submitted to WCA Live</p>
                                ) : (
                                    <AttemptsTable
                                        attempts={submittedAttempts as never}
                                        fetchData={fetchData}
                                        result={result}
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="standard">
                        <Card>
                            <CardHeader>
                                <CardTitle>Standard attempts</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {standardAttempts.length === 0 ? (
                                    <p>No attempts</p>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        <Button
                                            className="w-fit"
                                            onClick={() =>
                                                setIsOpenSwapAttemptsModal(true)
                                            }
                                        >
                                            Swap attempts
                                        </Button>
                                        <AttemptsTable
                                            attempts={standardAttempts}
                                            showExtraColumns
                                            fetchData={fetchData}
                                            result={result}
                                        />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="extra">
                        <Card>
                            <CardHeader>
                                <CardTitle>Extra attempts</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {extraAttempts.length === 0 ? (
                                    <p>No extra attempts</p>
                                ) : (
                                    <AttemptsTable
                                        attempts={extraAttempts}
                                        fetchData={fetchData}
                                        result={result}
                                        showExtraColumns
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
                <CreateAttemptModal
                    isOpen={isOpenCreateAttemptModal}
                    onClose={handleCloseModal}
                    roundId={result.roundId}
                    competitorId={result.person.id}
                    timeLimit={limit!}
                />
                <SwapAttemptsModal
                    isOpen={isOpenSwapAttemptsModal}
                    onClose={handleCloseModal}
                    attempts={standardAttempts}
                />
            </div>
        </PageTransition>
    );
};

export default SingleResult;
