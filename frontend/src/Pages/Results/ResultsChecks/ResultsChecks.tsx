import { Box, Heading } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import { Incident } from "@/logic/interfaces";
import { getResultsChecks } from "@/logic/results";

import ResultsChecksTable from "./Components/ResultsChecksTable";

const ResultsChecks = () => {
    const [checks, setChecks] = useState<Incident[]>([]);

    useEffect(() => {
        getResultsChecks().then(setChecks);
    }, []);

    return (
        <Box display="flex" flexDirection="column" gap="5">
            <Heading size="lg">Suspicious times/penalties</Heading>
            <ResultsChecksTable checks={checks} />
        </Box>
    );
};

export default ResultsChecks;
