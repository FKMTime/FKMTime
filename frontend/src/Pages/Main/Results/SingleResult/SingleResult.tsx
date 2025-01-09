import { useAtom } from "jotai";
import { AlertCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    getCutoffByRoundId,
    getLimitByRoundId,
    getNumberOfAttemptsForRound,
} from "wcif-helpers";

import FlagIcon from "@/Components/Icons/FlagIcon";
import LoadingPage from "@/Components/LoadingPage";
import PlusButton from "@/Components/PlusButton";
import { Alert, AlertTitle } from "@/Components/ui/alert";
import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import { getCompetitionInfo } from "@/lib/competition";
import { isUnofficialEvent } from "@/lib/events";
import { Result } from "@/lib/interfaces";
import {
    assignDnsOnRemainingSolves,
    getResultById,
    reSubmitScorecardToWcaLive,
} from "@/lib/results";
import {
    getSubmissionPlatformName,
    getSubmittedAttempts,
    isThereADifferenceBetweenResults,
} from "@/lib/utils";

import CreateAttemptModal from "../Components/CreateAttemptModal";
import RoundLimits from "../Components/RoundLimits";
import AttemptsTable from "./Components/AttemptsTable";

const SingleResult = () => {
    const { id } = useParams<{ id: string }>();
    const confirm = useConfirm();
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

    const isDifferenceBetweenResults = useMemo(() => {
        if (!result || !competition) return false;
        return isThereADifferenceBetweenResults(
            result,
            submittedAttempts,
            competition.wcif
        );
    }, [competition, result, submittedAttempts]);

    const cutoff = useMemo(() => {
        if (!competition || !result) {
            return null;
        }
        return getCutoffByRoundId(result.roundId, competition.wcif);
    }, [competition, result]);
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

    const submissionPlatformName = getSubmissionPlatformName(
        result?.eventId || ""
    );

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

    const handleResubmit = async () => {
        if (!result) return;
        const data = await reSubmitScorecardToWcaLive(result.id);
        if (data.status === 200) {
            toast({
                title: "Success",
                description: `Scorecard resubmitted to ${submissionPlatformName}`,
            });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
    };

    const handleCloseModal = () => {
        fetchData();
        setIsOpenCreateAttemptModal(false);
        setIsOpenSwapAttemptsModal(false);
    };

    const handleAssignDns = async () => {
        if (!result) return;
        confirm({
            title: "Assign DNS",
            description:
                "Are you sure you want to assign DNS on remaining attempts?",
        })
            .then(async () => {
                const status = await assignDnsOnRemainingSolves(result.id);
                if (status === 200) {
                    toast({
                        title: "Success",
                        description: "DNS assigned",
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
                    description: "Operation has been cancelled",
                });
            });
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (!result) return <LoadingPage />;

    return (
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <FlagIcon
                                country={result.person.countryIso2}
                                size={30}
                            />
                            {result.person.name} ({result.person.registrantId})
                            - {activityCodeToName(result.roundId)}
                        </div>

                        <PlusButton
                            onClick={() => setIsOpenCreateAttemptModal(true)}
                        />
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col md:flex-row gap-4">
                    <Button onClick={handleResubmit} variant="success">
                        Resubmit scorecard to {submissionPlatformName}
                    </Button>
                    {standardAttempts.length <= maxAttempts && (
                        <Button onClick={handleAssignDns}>
                            Assign DNS on remaing attempts
                        </Button>
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>{activityCodeToName(result.roundId)}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    {!isDifferenceBetweenResults &&
                        !isUnofficialEvent(result.eventId) && (
                            <Alert
                                variant="destructive"
                                className="flex gap-2 items-center"
                            >
                                <div>
                                    <AlertCircle />
                                </div>
                                <AlertTitle>
                                    There is a difference between results in WCA
                                    Live and FKM. Please check it manually, fix
                                    in FKM and resubmit scorecard to WCA Live.
                                </AlertTitle>
                            </Alert>
                        )}
                    <RoundLimits
                        cutoff={cutoff}
                        limit={limit}
                        maxAttempts={maxAttempts}
                        size={"lg"}
                    />
                </CardContent>
            </Card>
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
                            <TabsTrigger value="standard">Standard</TabsTrigger>
                            {extraAttempts.length > 0 && (
                                <TabsTrigger value="extra">Extra</TabsTrigger>
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
                                <AttemptsTable
                                    attempts={standardAttempts}
                                    showExtraColumns
                                    fetchData={fetchData}
                                    result={result}
                                />
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
            {/* <SwapAttemptsModal
                isOpen={isOpenSwapAttemptsModal}
                onClose={handleCloseModal}
                attempts={standardAttempts}
            /> */}
        </div>
    );
};

export default SingleResult;
