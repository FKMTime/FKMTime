import { Link } from "react-router-dom";

import { Button } from "@/Components/ui/button";
import { ScorecardResult } from "@/lib/interfaces";

interface EnterScorecardActionsProps {
    handleSubmit: () => void;
    result: ScorecardResult;
    isSaving: boolean;
}

const EnterScorecardActions = ({
    handleSubmit,
    result,
    isSaving,
}: EnterScorecardActionsProps) => (
    <div className="flex flex-col gap-2 md:flex-row">
        <Button onClick={handleSubmit} disabled={isSaving}>
            Save scorecard
        </Button>
        {result.id && (
            <Button variant="outline" asChild>
                <Link to={`/results/${result.id}`}>Details</Link>
            </Button>
        )}
    </div>
);

export default EnterScorecardActions;
