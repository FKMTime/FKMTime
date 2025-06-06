import { List } from "lucide-react";
import { useNavigate } from "react-router-dom";

import EventIcon from "@/Components/Icons/EventIcon";
import SmallIconButton from "@/Components/SmallIconButton";
import { TableCell, TableRow } from "@/Components/ui/table";
import { activityCodeToName } from "@/lib/activities";
import { average, best } from "@/lib/average";
import { Result } from "@/lib/interfaces";
import { isOrganizerOrDelegate } from "@/lib/permissions";
import { resultToString } from "@/lib/resultFormatters";
import { getSubmittedAttempts } from "@/lib/utils";

interface PersonResultRowProps {
    result: Result;
}

const PersonResultRow = ({ result }: PersonResultRowProps) => {
    const navigate = useNavigate();

    const submittedAttempts = getSubmittedAttempts(result.attempts);
    const calculatedAverage = average(submittedAttempts);

    return (
        <>
            <TableRow key={result.id}>
                <TableCell className="flex items-center gap-1">
                    <EventIcon
                        selected
                        eventId={result.roundId.split("-")[0]}
                    />
                    {activityCodeToName(result.roundId)}
                </TableCell>
                <TableCell>
                    {calculatedAverage
                        ? resultToString(calculatedAverage)
                        : "No average"}
                </TableCell>
                <TableCell>{resultToString(best(submittedAttempts))}</TableCell>
                {isOrganizerOrDelegate() && (
                    <TableCell>
                        <SmallIconButton
                            icon={<List />}
                            title="View attempts"
                            onClick={() => navigate(`/results/${result.id}`)}
                        />
                    </TableCell>
                )}
            </TableRow>
        </>
    );
};

export default PersonResultRow;
