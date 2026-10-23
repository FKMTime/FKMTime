import { Link } from "react-router-dom";

import { Button } from "@/Components/ui/button";
import { Result } from "@/lib/interfaces";

interface EnterScorecardActionsProps {
    handleSubmit: () => void;
    result: Result;
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
        <Button variant="outline" asChild>
            <Link to={`/results/${result.id}`}>Details</Link>
        </Button>
    </div>
);

export default EnterScorecardActions;
