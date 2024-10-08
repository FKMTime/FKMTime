import { Alert, AlertIcon, Button, ButtonGroup } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";

import { ResultToDoubleCheck } from "@/logic/interfaces";

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
        <>
            <Alert status="info" color="black" width="fit-content">
                <AlertIcon />
                If you want to make more changes please go to Details page
            </Alert>
            <ButtonGroup>
                <Button colorScheme="green" onClick={handleSubmit}>
                    Save
                </Button>
                <Button
                    colorScheme="purple"
                    onClick={() => navigate(`/results/${result.id}`)}
                >
                    Details
                </Button>
                <Button colorScheme="red" onClick={handleSkip}>
                    Skip
                </Button>
            </ButtonGroup>
        </>
    );
};

export default DoubleCheckActions;
