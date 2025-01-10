import { Incident } from "@/lib/interfaces";

interface IncidentWarningsProps {
    previousIncidents: Incident[];
}

const IncidentWarnings = ({ previousIncidents }: IncidentWarningsProps) => {
    if (previousIncidents.length === 0) return null;

    const incidentsReason = new Set(previousIncidents.map((i) => i.comment));

    return (
        <div>
            <p>Previous extras:</p>
            <ul className="list-disc pl-5">
                {Array.from(incidentsReason).map((reason) => (
                    <li key={reason}>
                        {reason} -{" "}
                        {
                            previousIncidents.filter(
                                (i) => i.comment === reason
                            ).length
                        }{" "}
                        {previousIncidents.filter((i) => i.comment === reason)
                            .length === 1
                            ? "time"
                            : "times"}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default IncidentWarnings;
