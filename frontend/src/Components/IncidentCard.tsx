import { Incident } from "../logic/interfaces.ts";
import { Card, CardBody, CardHeader, Heading, Text } from "@chakra-ui/react";
import { getRoundNameById } from "../logic/utils.ts";
import { Competition } from "@wca/helpers";
import { resultToString } from "../logic/resultFormatters.ts";
import { useNavigate } from "react-router-dom";

interface Props {
    incident: Incident;
    wcif: Competition;
}

const IncidentCard: React.FC<Props> = ({ incident, wcif }) => {
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
                <Text>Station: {incident.device.name}</Text>
                <Text>Judge: {incident.judge.name}</Text>
            </CardBody>
        </Card>
    );
};

export default IncidentCard;
