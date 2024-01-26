import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { getResultById, reSubmitScorecardToWcaLive } from "../../logic/results";
import LoadingPage from "../../Components/LoadingPage";
import { Result } from "../../logic/interfaces";
import { Alert, AlertIcon, Box, Button, Heading, Text, useToast } from "@chakra-ui/react";
import regions from "../../logic/regions";
import AttemptsTable from "../../Components/Table/AttemptsTable";
import { getSubmittedAttempts } from "../../logic/utils";


const SingleResult = (): JSX.Element => {
    const { id } = useParams<{ id: string }>();
    const toast = useToast();
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
        return getSubmittedAttempts(result.attempts);
    }, [result]);

    const fetchData = useCallback(async () => {
        if (!id) return;
        const data = await getResultById(+id);
        setResult(data);
    }, [id]);

    const handleResubmit = async () => {
        if (!result) return;
        const status = await reSubmitScorecardToWcaLive(result.id);
        if (status === 200) {
            toast({
                title: "Success",
                description: "Scorecard resubmitted to WCA Live",
                status: "success",
                duration: 5000,
                isClosable: true,
            });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        }
    };

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
            <Button colorScheme="yellow" w="20%" onClick={handleResubmit}>
                Resubmit scorecard to WCA Live
            </Button>
            <Heading mt={3}>
                Attempts
            </Heading>
            <Heading size="md">
                List of attempts submitted to WCA Live
            </Heading>
            {submittedAttempts.length === 0 ? <Text>No attempts submitted to WCA Live</Text> : <AttemptsTable attempts={submittedAttempts as never} fetchData={fetchData} />}
            <Heading size="md">
                Standard
            </Heading>
            {standardAttempts.length === 0 ? <Text>No attempts</Text> : <AttemptsTable attempts={standardAttempts} showExtraColumns fetchData={fetchData} />}
            <Heading size="md">
                Extra
            </Heading>
            {extraAttempts.length === 0 ? <Text>No extra attempts</Text> : <AttemptsTable attempts={extraAttempts} fetchData={fetchData} />}

            <Heading mt={3}>
                Important information
            </Heading>
            <Alert status='info' color="black">
                <AlertIcon />
                Extra attempts should NEVER have an case set to true - we don't replace extra attempts by next extra, we only replace the original one.
            </Alert>
        </Box>

    )
};

export default SingleResult;
