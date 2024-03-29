import {
    Modal as ChakraModal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalHeader,
    ModalOverlay,
} from "@chakra-ui/react";
import { ReactNode } from "react";

interface ModalProps {
    onClose: () => void;
    isOpen: boolean;
    title: string;
    children: ReactNode;
}

export const Modal = ({ onClose, isOpen, title, children }: ModalProps) => {
    return (
        <>
            <ChakraModal isOpen={isOpen} onClose={onClose}>
                <ModalOverlay />
                <ModalContent bg="gray.700" color="white" pb="3">
                    <ModalHeader>{title}</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>{children}</ModalBody>
                </ModalContent>
            </ChakraModal>
        </>
    );
};
