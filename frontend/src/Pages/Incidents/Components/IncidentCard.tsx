import { Card, CardBody, CardHeader, Heading, Text } from "@chakra-ui/react";
import { Competition } from "@wca/helpers";
import { useNavigate } from "react-router-dom";

import { Incident } from "@/logic/interfaces";
import { resultToString } from "@/logic/resultFormatters";
import { getRoundNameById } from "@/logic/utils";

interface IncidentCardProps {
    incident: Incident;
    wcif: Competition;
}

const IncidentCard = ({ incident, wcif }: IncidentCardProps) => {
    const navigate = useNavigate();

    return (
        <Card
            backgroundColor="teal.500"
            color="white"
            textAlign="center"
            width="fit-content"
            cursor="pointer"
            onClick={() => navigate(`/incidents/${incident.id}`)}
        >
            <CardHeader>
                <Heading size="md">
                    {incident.result.person.name} (
                    {incident.result.person.registrantId})
                </Heading>
            </CardHeader>
            <CardBody>
                <Text>{getRoundNameById(incident.result.roundId, wcif)}</Text>
                <Text>Attempt: {incident.attemptNumber}</Text>
                <Text>Time: {resultToString(incident.value)}</Text>
                {incident.device && (
                    <Text>Station: {incident.device.name}</Text>
                )}
                {incident.judge && <Text>Judge: {incident.judge.name}</Text>}
            </CardBody>
        </Card>
    );
};

export default IncidentCard;
