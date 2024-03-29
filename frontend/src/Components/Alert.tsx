import {
    AlertDialog,
    AlertDialogBody,
    AlertDialogContent,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogOverlay,
    Button,
} from "@chakra-ui/react";
import { useRef } from "react";

interface AlertProps {
    isOpen: boolean;
    onCancel: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
}

const Alert = ({
    isOpen,
    onCancel,
    onConfirm,
    title,
    description,
}: AlertProps) => {
    return (
        <AlertDialog
            isOpen={isOpen}
            onClose={onCancel}
            leastDestructiveRef={useRef(null)}
        >
            <AlertDialogOverlay>
                <AlertDialogContent backgroundColor="gray.700" color="white">
                    <AlertDialogHeader fontSize="lg" fontWeight="bold">
                        {title}
                    </AlertDialogHeader>

                    <AlertDialogBody>
                        {description ?? "Are you sure?"}
                    </AlertDialogBody>

                    <AlertDialogFooter>
                        <Button onClick={onCancel}>Cancel</Button>
                        <Button colorScheme="red" onClick={onConfirm} ml={3}>
                            Confirm
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialogOverlay>
        </AlertDialog>
    );
};

export default Alert;
