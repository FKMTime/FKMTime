import { useNavigate } from "react-router-dom";

import EventIcon from "@/Components/Icons/EventIcon";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { activityCodeToName } from "@/lib/activities";
import { Incident } from "@/lib/interfaces";
import { resultToString } from "@/lib/resultFormatters";

interface IncidentCardProps {
    incident: Incident;
}

const IncidentCard = ({ incident }: IncidentCardProps) => {
    const navigate = useNavigate();

    return (
        <Card
            className="cursor-pointer"
            onClick={() => navigate(`/incidents/${incident.id}`)}
        >
            <CardHeader>
                <CardTitle>
                    {incident.result.person.name} (
                    {incident.result.person.registrantId})
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex gap-1">
                    <EventIcon selected eventId={incident.result.eventId} />
                    {activityCodeToName(incident.result.roundId)}
                </div>
                <p>Attempt: {incident.attemptNumber}</p>
                <p>Time: {resultToString(incident.value)}</p>
                {incident.device && <p>Station: {incident.device.name}</p>}
                {incident.judge && <p>Judge: {incident.judge.name}</p>}
            </CardContent>
        </Card>
    );
};

export default IncidentCard;
