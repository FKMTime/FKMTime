import { List } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import AttemptWarnings from "@/Components/AttemptWarnings";
import EventIcon from "@/Components/Icons/EventIcon";
import SmallIconButton from "@/Components/SmallIconButton";
import { TableCell, TableRow } from "@/Components/ui/table";
import { activityCodeToName } from "@/lib/activities";
import { AttemptType, Incident } from "@/lib/interfaces";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";

interface ResultsCheckRowProps {
    check: Incident;
}

const ResultsCheckRow = ({ check }: ResultsCheckRowProps) => {
    const navigate = useNavigate();
    return (
        <TableRow>
            <TableCell>{check.result.person.name}</TableCell>
            <TableCell>
                <Link
                    className="text-blue-500 flex items-center gap-1"
                    to={`/results/round/${check.result.roundId}`}
                >
                    <EventIcon
                        selected
                        eventId={check.result.roundId.split("-")[0]}
                    />
                    {activityCodeToName(check.result.roundId)}
                </Link>
            </TableCell>
            <TableCell>
                {check.type === AttemptType.EXTRA_ATTEMPT
                    ? `E${check.attemptNumber}`
                    : check.attemptNumber}
            </TableCell>
            <TableCell>{attemptWithPenaltyToString(check)}</TableCell>
            <TableCell>{check.comment}</TableCell>
            <TableCell>{check.judge?.name}</TableCell>
            <TableCell>
                <div className="flex gap-2">
                    <AttemptWarnings attempt={check} />
                </div>
            </TableCell>
            <TableCell>
                <SmallIconButton
                    icon={<List />}
                    title="View attempts"
                    onClick={() => navigate(`/results/${check.result.id}`)}
                />
            </TableCell>
        </TableRow>
    );
};

export default ResultsCheckRow;
