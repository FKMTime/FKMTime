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
                <AlertTitle>
                    There are {personsWithoutCardAssigned} persons without a
                    card assigned. Please assign a card to them.
                </AlertTitle>
            </Alert>
        </>
    );
};

export default AssignCardsAlert;
