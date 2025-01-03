import { ReactNode } from "react";

import {
    DialogBody,
    DialogContent,
    DialogHeader,
    DialogRoot,
    DialogTitle,
} from "@/Components/ui/dialog";

interface ModalProps {
    onClose: () => void;
    isOpen: boolean;
    title: string;
    children: ReactNode;
}

export const Modal = ({ onClose, isOpen, title, children }: ModalProps) => {
    return (
        <DialogRoot open={isOpen} onInteractOutside={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <DialogBody>{children}</DialogBody>
            </DialogContent>
        </DialogRoot>
    );
};
