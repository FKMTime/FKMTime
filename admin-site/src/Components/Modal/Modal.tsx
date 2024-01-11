import {
    Modal as ChakraModal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalCloseButton,
    ModalBody,
} from "@chakra-ui/react";

interface ModalProps {
    onClose: () => void;
    isOpen: boolean;
    title: string;
    children: React.ReactNode;
}


export const Modal: React.FC<ModalProps> = ({ onClose, isOpen, title, children }) => {
    return (
        <>
            <ChakraModal isOpen={isOpen} onClose={onClose}>
                <ModalOverlay />
                <ModalContent bg='gray.700' color='white' pb="3">
                    <ModalHeader>{title}</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        {children}
                    </ModalBody>
                </ModalContent>
            </ChakraModal>
        </>
    )
}
