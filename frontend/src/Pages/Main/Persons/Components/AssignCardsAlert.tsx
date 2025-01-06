import { AlertCircle } from "lucide-react";

import { Alert, AlertTitle } from "@/Components/ui/alert";

interface AssignCardsAlertProps {
    personsWithoutCardAssigned: number;
}

const AssignCardsAlert = ({
    personsWithoutCardAssigned,
}: AssignCardsAlertProps) => {
    return (
        <>
            <Alert variant="warning">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>
                    There are {personsWithoutCardAssigned} persons without a
                    card assigned. Please assign a card to them.
                </AlertTitle>
            </Alert>
        </>
    );
};

export default AssignCardsAlert;
