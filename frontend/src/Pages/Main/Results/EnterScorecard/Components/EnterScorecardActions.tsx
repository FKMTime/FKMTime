import { useNavigate } from "react-router-dom";

import { Button } from "@/Components/ui/button";
import { Result } from "@/lib/interfaces";

interface EnterScorecardActionsProps {
    handleSubmit: () => void;
    result: Result;
}

const EnterScorecardActions = ({
    handleSubmit,
    result,
}: EnterScorecardActionsProps) => {
    const navigate = useNavigate();
    return (
        <div className="flex md:flex-row flex-col gap-3">
            <Button variant="success" onClick={handleSubmit}>
                Save
            </Button>
            <Button onClick={() => navigate(`/results/${result.id}`)}>
                Details
            </Button>
        </div>
    );
};

export default EnterScorecardActions;
