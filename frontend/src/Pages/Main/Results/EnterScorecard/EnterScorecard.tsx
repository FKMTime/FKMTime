import { useAtomValue } from "jotai";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getNumberOfAttemptsForRound } from "wcif-helpers";

import EventIcon from "@/Components/Icons/EventIcon";
import LoadingPage from "@/Components/LoadingPage";
import PersonAutocomplete from "@/Components/PersonAutocomplete";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import {
    AttemptStatus,
    AttemptToEnterWithScorecard,
    AttemptType,
    Result,
} from "@/lib/interfaces";
import { enterScorecard, getResultByRoundIdAndPersonId } from "@/lib/results";
import { getSubmittedAttempts } from "@/lib/utils";
import PageTransition from "@/Pages/PageTransition";

import AttemptsList from "./Components/AttemptsList";
import EnterScorecardActions from "./Components/EnterScorecardActions";

const EnterScorecard = () => {
    const { id } = useParams<{ id: string }>();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [result, setResult] = useState<Result | null>(null);
    const [attempts, setAttempts] = useState<AttemptToEnterWithScorecard[]>([]);
    const roundName = activityCodeToName(id || "");
    const competition = useAtomValue(competitionAtom);
    const maxAttempts = useMemo(
        () =>
            competition && id
                ? getNumberOfAttemptsForRound(id, competition.wcif)
                : 5,
        [id, competition]
    );

    const handleSelectPerson = async (personId?: string) => {
        if (!personId || !id) return;

        const response = await getResultByRoundIdAndPersonId(id, personId);
        if (response.status !== 200) return;

        const submitted = getSubmittedAttempts(response.data.attempts);

        const filled = Array.from({ length: maxAttempts }, (_, i) => {
            const existing = submitted.find((a) => a.attemptNumber === i + 1);
            return (
                existing ?? {
                    id: `new-${i + 1}`,
                    attemptNumber: i + 1,
                    type: AttemptType.STANDARD_ATTEMPT,
                    value: 0,
                    penalty: 0,
                    status: AttemptStatus.STANDARD,
                    resultId: response.data.id,
                    replacedBy: null,
                    solvedAt: new Date(),
                    isNew: true,
                }
            );
        });

        setResult(response.data);
        setAttempts(filled);
    };

    const updateAttempt = (updated: AttemptToEnterWithScorecard) => {
        setAttempts((prev) =>
            prev.map((a) =>
                a.attemptNumber === updated.attemptNumber ? updated : a
            )
        );
    };

    const handleSubmit = async () => {
        if (!result) return;
        const attemptsToCreate = attempts.filter(
            (a) => a.isNew && (a.value !== 0 || a.penalty !== 0)
        );
        const attemptsToUpdate = attempts.filter((a) => !a.isNew);
        const response = await enterScorecard({
            resultId: result!.id,
            attempts: attemptsToUpdate,
            newAttempts: attemptsToCreate.map((a) => ({
                roundId: result!.roundId,
                competitorId: result!.person.id,
                comment: "",
                attemptNumber: a.attemptNumber,
                type: a.type,
                value: a.value,
                penalty: a.penalty,
                status: a.status,
            })),
        });
        if (response.status === 200) {
            toast({
                title: "Scorecard entered",
                description: "The scorecard has been successfully entered.",
                variant: "success",
            });
            navigate(`/results/round/${result.roundId}/`);
        } else {
            toast({
                title: "Error entering scorecard",
                description:
                    response.data.message ||
                    "An error occurred while entering the scorecard.",
                variant: "destructive",
            });
        }
    };

    if (!id) return <LoadingPage />;

    return (
        <PageTransition>
            <div className="flex flex-col gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <EventIcon
                                eventId={id.split("-r")[0]}
                                size={20}
                                selected
                            />
                            {roundName}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <PersonAutocomplete
                            onSelect={(person) =>
                                handleSelectPerson(person?.id)
                            }
                            defaultValue={result?.person.id}
                        />
                    </CardContent>
                </Card>

                {result && (
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                {result.person.name} (
                                {result.person.registrantId})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            {competition && (
                                <AttemptsList
                                    attempts={attempts}
                                    competition={competition}
                                    roundId={result.roundId}
                                    onChange={updateAttempt}
                                />
                            )}
                            <EnterScorecardActions
                                handleSubmit={handleSubmit}
                                result={result}
                            />
                        </CardContent>
                    </Card>
                )}
            </div>
        </PageTransition>
    );
};

export default EnterScorecard;
