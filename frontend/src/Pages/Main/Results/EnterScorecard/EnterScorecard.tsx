import { useAtomValue } from "jotai";
import { CircleCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getNumberOfAttemptsForRound } from "wcif-helpers";

import LoadingPage from "@/Components/LoadingPage";
import EmptyState from "@/Components/shared/EmptyState";
import InlineError from "@/Components/shared/InlineError";
import { competitionAtom } from "@/lib/atoms";
import {
    AttemptStatus,
    AttemptToEnterWithScorecard,
    AttemptType,
    Person,
    Result,
} from "@/lib/interfaces";
import { getAllPersons } from "@/lib/persons";
import { enterScorecard, getResultByRoundIdAndPersonId } from "@/lib/results";
import { getSubmittedAttempts } from "@/lib/utils";

import RoundSubpageHeader from "../Components/RoundSubpageHeader";
import SelectCompetitor from "../Components/SelectCompetitor";
import AttemptsList from "./Components/AttemptsList";
import EnterScorecardActions from "./Components/EnterScorecardActions";

const EnterScorecard = () => {
    const { id } = useParams<{ id: string }>();
    const [result, setResult] = useState<Result | null>(null);
    const [attempts, setAttempts] = useState<AttemptToEnterWithScorecard[]>([]);
    const [persons, setPersons] = useState<Person[]>([]);
    const [inputValue, setInputValue] = useState<string>("");
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    // The scorecard saved last, so the desk can go straight on to the next
    const [lastSaved, setLastSaved] = useState<{
        name: string;
        resultId: string;
    } | null>(null);

    const idInputRef = useRef<HTMLInputElement>(null);
    const competition = useAtomValue(competitionAtom);
    const maxAttempts = useMemo(
        () =>
            competition && id
                ? getNumberOfAttemptsForRound(id, competition.wcif)
                : 5,
        [id, competition]
    );

    useEffect(() => {
        getAllPersons().then(setPersons);
    }, []);

    const handleSelectPerson = useCallback(
        async (person: Person | null) => {
            if (!person || !id) return;

            const response = await getResultByRoundIdAndPersonId(id, person.id);
            if (response.status !== 200) return;

            const submitted = getSubmittedAttempts(response.data.attempts);

            const filled = Array.from({ length: maxAttempts }, (_, i) => {
                const existing = submitted.find(
                    (a) => a.attemptNumber === i + 1
                );
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
            setSaveError("");
        },
        [id, maxAttempts]
    );

    const updateAttempt = (updated: AttemptToEnterWithScorecard) => {
        setAttempts((prev) =>
            prev.map((a) =>
                a.attemptNumber === updated.attemptNumber ? updated : a
            )
        );
    };

    const handleSubmit = async () => {
        if (!result || isSaving) return;
        const attemptsToCreate = attempts.filter(
            (a) => a.isNew && (a.value !== 0 || a.penalty !== 0)
        );
        const attemptsToUpdate = attempts.filter((a) => !a.isNew);
        setIsSaving(true);
        setSaveError("");
        const response = await enterScorecard({
            resultId: result.id,
            attempts: attemptsToUpdate,
            newAttempts: attemptsToCreate.map((a) => ({
                roundId: result.roundId,
                competitorId: result.person.id,
                comment: "",
                attemptNumber: a.attemptNumber,
                type: a.type,
                value: a.value,
                penalty: a.penalty,
                status: a.status,
            })),
        });
        setIsSaving(false);
        if (response.status !== 200) {
            setSaveError(
                response.data.message || "The scorecard could not be saved."
            );
            return;
        }
        setLastSaved({ name: result.person.name, resultId: result.id });
        setResult(null);
        setAttempts([]);
        setInputValue("");
        idInputRef.current?.focus();
    };

    if (!id) return <LoadingPage />;

    return (
        <div className="flex flex-col gap-5">
            <RoundSubpageHeader roundId={id} title="Enter scorecard" />
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
                <section className="flex flex-col gap-3 rounded-mobile-card border bg-card p-4 md:rounded-2xl md:p-5">
                    {lastSaved && (
                        <p
                            role="status"
                            className="flex flex-wrap items-center gap-2 rounded-[10px] bg-success-soft px-3 py-2.5 text-sm font-semibold text-success"
                        >
                            <CircleCheck className="size-[18px] shrink-0" />
                            Saved {lastSaved.name}&apos;s scorecard
                            <Link
                                to={`/results/${lastSaved.resultId}`}
                                className="ml-auto font-semibold underline-offset-4 hover:underline"
                            >
                                Open result
                            </Link>
                        </p>
                    )}
                    <h3 className="text-sm font-semibold">Competitor</h3>
                    <SelectCompetitor
                        idInputRef={idInputRef}
                        handleSubmit={handleSubmit}
                        persons={persons}
                        onSelect={handleSelectPerson}
                        inputValue={inputValue}
                        setInputValue={setInputValue}
                    />
                </section>
                {result ? (
                    <section className="flex flex-col gap-4 rounded-mobile-card border bg-card p-4 md:rounded-2xl md:p-5">
                        <h3 className="text-lg font-bold">
                            {result.person.name}
                            <span className="font-normal text-muted-foreground">
                                {" "}
                                ({result.person.registrantId})
                            </span>
                        </h3>
                        {competition && (
                            <AttemptsList
                                attempts={attempts}
                                competition={competition}
                                roundId={result.roundId}
                                onChange={updateAttempt}
                            />
                        )}
                        <InlineError>{saveError}</InlineError>
                        <EnterScorecardActions
                            handleSubmit={handleSubmit}
                            result={result}
                            isSaving={isSaving}
                        />
                    </section>
                ) : (
                    <EmptyState className="hidden lg:flex">
                        Enter the ID from the next scorecard.
                    </EmptyState>
                )}
            </div>
        </div>
    );
};

export default EnterScorecard;
