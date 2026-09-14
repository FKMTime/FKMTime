import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/Components/ui/button";
import { ResultToDoubleCheck } from "@/lib/interfaces";

interface DoubleCheckActionsProps {
    handleSubmit: () => void;
    handleSkip: () => void;
    result: ResultToDoubleCheck;
    isSubmitting: boolean;
}

const DoubleCheckActions = ({
    handleSubmit,
    handleSkip,
    result,
    isSubmitting,
}: DoubleCheckActionsProps) => {
    const navigate = useNavigate();
    return (
        <div className="flex md:flex-row flex-col gap-3">
            <Button
                variant="success"
                onClick={handleSubmit}
                disabled={isSubmitting}
            >
                {isSubmitting ? (
                    <Loader2 className="animate-spin" size={16} />
                ) : (
                    "Save"
                )}
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
