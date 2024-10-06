import { Alert, AlertIcon, Button } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";

interface AssignCardsAlertProps {
    personsWithoutCardAssigned: number;
}

const AssignCardsAlert = ({
    personsWithoutCardAssigned,
}: AssignCardsAlertProps) => {
    const navigate = useNavigate();
    return (
        <>
            <Alert
                status="error"
                color="black"
                width={{ base: "100%", md: "40%" }}
            >
                <AlertIcon />
                There are {personsWithoutCardAssigned} persons without a card
                assigned. Please assign a card to them.
            </Alert>
            <Button
                onClick={() => {
                    navigate("/cards");
                }}
                colorScheme="yellow"
                width={{ base: "100%", md: "20%" }}
            >
                Assign cards
            </Button>
        </>
    );
};

export default AssignCardsAlert;
