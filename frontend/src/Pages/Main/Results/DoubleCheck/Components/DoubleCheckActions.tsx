import { useNavigate } from "react-router-dom";

import { Button } from "@/Components/ui/button";
import { ResultToDoubleCheck } from "@/lib/interfaces";

interface DoubleCheckActionsProps {
    handleSubmit: () => void;
    handleSkip: () => void;
    result: ResultToDoubleCheck;
}

const DoubleCheckActions = ({
    handleSubmit,
    handleSkip,
    result,
}: DoubleCheckActionsProps) => {
    const navigate = useNavigate();
    return (
        <div className="flex md:flex-row flex-col gap-3">
            <Button variant="success" onClick={handleSubmit}>
                Save
            </Button>
            <Button onClick={() => navigate(`/results/${result.id}`)}>
                Details
            </Button>
            <Button variant="destructive" onClick={handleSkip}>
                Skip
            </Button>
        </div>
    );
};

export default DoubleCheckActions;
