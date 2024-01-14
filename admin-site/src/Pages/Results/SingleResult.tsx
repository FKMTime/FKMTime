import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { getResultById } from "../../logic/results";
import LoadingPage from "../../Components/LoadingPage";
import { Attempt, Result } from "../../logic/interfaces";
import { Box, Heading, Text } from "@chakra-ui/react";
import regions from "../../logic/regions";
import AttemptsTable from "../../Components/Table/AttemptsTable";


const SingleResult = (): JSX.Element => {
    const { id } = useParams<{ id: string }>();
    const [result, setResult] = useState<Result | null>(null);
    const standardAttempts = useMemo(() => {
        if (!result) return [];
        return result.attempts.filter(attempt => attempt.isExtraAttempt === false) || [];
    }, [result]);
    const extraAttempts = useMemo(() => {
        if (!result) return [];
        return result.attempts.filter(attempt => attempt.isExtraAttempt === true) || [];
    }, [result]);
    const submittedAttempts = useMemo(() => {
        if (!result) return [];
        const attemptsToReturn: Attempt[] = [];
        result.attempts.forEach((attempt) => {
            if (attempt.replacedBy === null && !attempt.extraGiven && !attemptsToReturn.some((a) => a.id === attempt.id) && !attempt.isExtraAttempt) attemptsToReturn.push(attempt);
            if (attempt.replacedBy !== null && attempt.extraGiven) {
                const extraAttempt = result.attempts.find(a => a.attemptNumber === attempt.replacedBy && a.isExtraAttempt === true);
                if (extraAttempt && !attemptsToReturn.some(a => a.id === extraAttempt.id)) {
                    attemptsToReturn.push(extraAttempt);
                }
            }
        });
        return attemptsToReturn;
    }, [result]);

    const fetchData = useCallback(async () => {
        if (!id) return;
        const data = await getResultById(+id);
        setResult(data);
    }, [id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (!result) return <LoadingPage />;

    return (
        <Box display="flex" flexDirection="column" gap={3}>
            <Heading>
                Competitor
            </Heading>
            <Text fontSize="xl">
                Name:  {result.person.name}
            </Text>
            <Text fontSize="xl">
                Registrant ID: {result.person.registrantId}
            </Text>
            <Text fontSize="xl">
                WCA ID: {result.person.wcaId}
            </Text>
            <Text fontSize="xl">
                Representing: {regions.find(region => region.iso2 === result.person.countryIso2)?.name}
            </Text>
            <Heading mt={3}>
                Attempts
            </Heading>
            <Heading size="md">
                List of attempts submitted to WCA Live
            </Heading>
            {submittedAttempts.length === 0 ? <Text>No attempts submitted to WCA Live</Text> : <AttemptsTable attempts={submittedAttempts as never} />}
            <Heading size="md">
                Standard
            </Heading>
            {standardAttempts.length === 0 ? <Text>No attempts</Text> : <AttemptsTable attempts={standardAttempts} showExtraColumns />}
            <Heading size="md">
                Extra
            </Heading>
            {extraAttempts.length === 0 ? <Text>No extra attempts</Text> : <AttemptsTable attempts={extraAttempts} />}
        </Box>
    )
};

export default SingleResult;
